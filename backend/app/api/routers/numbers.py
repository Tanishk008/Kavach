"""Number look-up, reverse fraud search, and reporting."""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.numbers import (
    NumberCheckRequest,
    NumberCheckResponse,
    PayCheckRequest,
    PayCheckResponse,
    ReportRequest,
    ReportResponse,
)
from app.services import number_intel

router = APIRouter(prefix="/api", tags=["numbers"])


@router.post("/numbers/check", response_model=NumberCheckResponse)
def check_number(req: NumberCheckRequest, db: Session = Depends(get_db)) -> NumberCheckResponse:
    return number_intel.check_number(db, req.number.strip())


@router.post("/pay/check", response_model=PayCheckResponse)
def check_before_pay(req: PayCheckRequest, db: Session = Depends(get_db)) -> PayCheckResponse:
    return number_intel.reverse_fraud_search(db, req.identifier.strip())


@router.post("/reports", response_model=ReportResponse)
def report_identifier(req: ReportRequest, db: Session = Depends(get_db)) -> ReportResponse:
    user_id = uuid.UUID(req.user_id) if req.user_id else None
    report, total = number_intel.add_report(
        db, req.identifier.strip(), req.identifier_type, req.category, user_id, req.note
    )
    return ReportResponse(id=str(report.id), identifier=report.identifier, total_reports=total)
