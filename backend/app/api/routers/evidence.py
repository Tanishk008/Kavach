"""Evidence export / case file router."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Case, Event
from app.schemas.evidence import CaseFileResponse, GenerateCaseRequest
from app.services import evidence

router = APIRouter(prefix="/api/evidence", tags=["evidence"])


@router.post("/case", response_model=CaseFileResponse)
def generate_case(req: GenerateCaseRequest, db: Session = Depends(get_db)) -> CaseFileResponse:
    # Assemble the payload either from a stored event or free-form content.
    if req.event_id:
        event = db.get(Event, req.event_id)
        if event is None:
            raise HTTPException(status_code=404, detail="Event not found")
        payload = {
            "event_id": str(event.id),
            "tier": event.tier,
            "scam_type": event.scam_type,
            "reasons": event.reasons,
            "content_excerpt": event.content_excerpt,
            "created_at": event.created_at.isoformat() if event.created_at else None,
        }
    elif req.content:
        payload = {**req.content, "created_at": datetime.now(timezone.utc).isoformat()}
    else:
        raise HTTPException(status_code=400, detail="Provide event_id or content")

    sha = evidence.compute_hash(payload)
    payload["sha256_hash"] = sha

    case = Case(
        user_id=req.user_id or None,
        event_id=req.event_id or None,
        payload=payload,
        sha256_hash=sha,
    )
    db.add(case)
    db.commit()
    db.refresh(case)

    return CaseFileResponse(
        case_id=str(case.id),
        sha256_hash=sha,
        cluster_ref=case.cluster_ref,
        payload=payload,
        ncrp_draft=evidence.build_ncrp_draft(payload),
    )
