from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from datetime import datetime

from app.db.session import get_db
from app.models import Event

router = APIRouter(prefix="/api/feed", tags=["feed"])

class AlertResponse(BaseModel):
    id: str
    scam_type: str
    region_city: str
    created_at: datetime
    
@router.get("/alerts", response_model=List[AlertResponse])
def get_live_alerts(db: Session = Depends(get_db)):
    # Fetch recent high risk events
    events = db.scalars(
        select(Event)
        .where(Event.tier == "high_risk", Event.region_city.is_not(None))
        .order_by(Event.created_at.desc())
        .limit(5)
    ).all()
    
    # If the DB is empty, provide some mocked alerts so the UI looks good
    if not events:
        now = datetime.utcnow()
        return [
            AlertResponse(id="mock1", scam_type="KYC Fraud", region_city="Mumbai", created_at=now),
            AlertResponse(id="mock2", scam_type="Courier Scam", region_city="Delhi", created_at=now),
            AlertResponse(id="mock3", scam_type="Electricity Bill Scam", region_city="Bangalore", created_at=now),
        ]
        
    return [AlertResponse(
        id=e.id,
        scam_type=e.scam_type or "Unknown Threat",
        region_city=e.region_city,
        created_at=e.created_at
    ) for e in events]
