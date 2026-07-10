"""Scam hotspot map and pattern dashboard."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Event
from app.schemas.map import DashboardResponse, HotspotResponse, HotspotZone, TrendPoint

router = APIRouter(prefix="/api", tags=["intelligence"])

_WINDOW_DAYS = {"week": 7, "month": 30}


def _risk_level(count: int) -> str:
    if count >= 20:
        return "red"
    if count >= 10:
        return "orange"
    if count >= 3:
        return "yellow"
    return "green"


@router.get("/hotspots", response_model=HotspotResponse)
def hotspots(window: str = Query("week"), db: Session = Depends(get_db)) -> HotspotResponse:
    since = datetime.now(timezone.utc) - timedelta(days=_WINDOW_DAYS.get(window, 7))
    rows = db.execute(
        select(Event.region_city, func.count().label("n"))
        .where(Event.region_city.is_not(None), Event.created_at >= since)
        .group_by(Event.region_city)
    ).all()

    zones = [
        HotspotZone(
            region_city=city, risk_level=_risk_level(n), report_count=n,
            top_scam_types=_top_scam_types(db, city, since),
        )
        for city, n in rows
    ]
    if not zones:  # demo fallback
        zones = [
            HotspotZone(region_city="Delhi", risk_level="red", report_count=24,
                        top_scam_types=["digital_arrest", "investment_fraud"]),
            HotspotZone(region_city="Mumbai", risk_level="orange", report_count=13,
                        top_scam_types=["loan_fraud", "digital_arrest"]),
            HotspotZone(region_city="Jaipur", risk_level="yellow", report_count=5,
                        top_scam_types=["delivery_customs"]),
        ]
    return HotspotResponse(window=window, zones=zones)


def _top_scam_types(db: Session, city: str, since: datetime) -> list[str]:
    rows = db.execute(
        select(Event.scam_type, func.count().label("n"))
        .where(Event.region_city == city, Event.scam_type.is_not(None), Event.created_at >= since)
        .group_by(Event.scam_type).order_by(func.count().desc()).limit(3)
    ).all()
    return [r[0] for r in rows]


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(window: str = Query("week"), db: Session = Depends(get_db)) -> DashboardResponse:
    since = datetime.now(timezone.utc) - timedelta(days=_WINDOW_DAYS.get(window, 7))
    rows = db.execute(
        select(Event.scam_type, func.count().label("n"))
        .where(Event.scam_type.is_not(None), Event.created_at >= since)
        .group_by(Event.scam_type).order_by(func.count().desc())
    ).all()
    trending = [TrendPoint(scam_type=r[0], count=r[1], is_spiking=r[1] >= 10) for r in rows]
    if not trending:
        trending = [
            TrendPoint(scam_type="digital_arrest", count=42, is_spiking=True),
            TrendPoint(scam_type="loan_fraud", count=18, is_spiking=False),
        ]
    return DashboardResponse(window=window, trending=trending)
