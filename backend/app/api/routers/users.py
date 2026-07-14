from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.db.session import get_db
from app.models import User, Event

router = APIRouter(prefix="/api/users", tags=["users"])

class EventResponse(BaseModel):
    id: str
    input_type: str
    tier: str
    created_at: datetime
    content_excerpt: Optional[str] = None
    scam_type: Optional[str] = None

class ScoreResponse(BaseModel):
    score: int

class IncrementScoreRequest(BaseModel):
    points: int

@router.get("/me/events", response_model=List[EventResponse])
def get_my_events(phone: str = "9990001234", db: Session = Depends(get_db)):
    # Mocking auth by just looking up by phone since the frontend uses localStorage
    user = db.scalar(select(User).where(User.phone_number == phone))
    if not user:
        return []
        
    events = db.scalars(
        select(Event)
        .where(Event.user_id == user.id)
        .order_by(Event.created_at.desc())
        .limit(50)
    ).all()
    
    return [EventResponse(
        id=e.id,
        input_type=e.input_type,
        tier=e.tier,
        created_at=e.created_at,
        content_excerpt=e.content_excerpt,
        scam_type=e.scam_type
    ) for e in events]

@router.get("/me/score", response_model=ScoreResponse)
def get_my_score(phone: str = "9990001234", db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.phone_number == phone))
    if not user:
        return ScoreResponse(score=0)
    return ScoreResponse(score=user.safety_score)

@router.post("/me/score", response_model=ScoreResponse)
def increment_score(req: IncrementScoreRequest, phone: str = "9990001234", db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.phone_number == phone))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cap score at 100
    user.safety_score = min(100, user.safety_score + req.points)
    db.commit()
    db.refresh(user)
    return ScoreResponse(score=user.safety_score)
