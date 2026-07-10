"""Message classification router."""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Event
from app.schemas.classification import ClassifyRequest, ClassifyResponse
from app.services import classifier, graph_service

router = APIRouter(prefix="/api/messages", tags=["messages"])


@router.post("/classify", response_model=ClassifyResponse)
def classify_message(req: ClassifyRequest, db: Session = Depends(get_db)) -> ClassifyResponse:
    result = classifier.classify_text(req)

    event = Event(
        user_id=uuid.UUID(req.user_id) if req.user_id else None,
        channel=req.channel.value,
        input_type=req.input_type,
        content_excerpt=req.text[:500],
        tier=result.tier.value,
        confidence=result.confidence,
        scam_type=result.scam_type,
        reasons=result.reasons,
        matched_playbook_id=result.playbook.id if result.playbook else None,
        region_city=req.region_city,
        region_pin=req.region_pin,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    result.event_id = str(event.id)

    if result.tier.value != "safe":
        entities = graph_service.extract_entities(req.text)
        if any(entities.values()):
            graph_service.add_report_to_graph(str(event.id), result.scam_type, entities)

    return result
