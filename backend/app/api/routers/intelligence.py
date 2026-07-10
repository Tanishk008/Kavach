"""Intelligence API router — events, hotspots, stats, search, pipeline trigger.

Endpoints:
    GET  /intelligence/events          — paginated list with filters
    GET  /intelligence/events/{id}     — single event detail
    GET  /intelligence/hotspots        — city hotspots with lat/lng
    GET  /intelligence/stats           — aggregate dashboard statistics
    GET  /intelligence/search          — full-text search
    POST /intelligence/pipeline/run    — manual pipeline trigger
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.intelligence.scheduler import get_scheduler_status, run_pipeline
from app.models.intelligence import CrimeEvent, Hotspot, RawArticle, SchedulerLog
from app.schemas.intelligence import (
    CrimeEventList,
    CrimeEventOut,
    CrimeTypeCount,
    HotspotList,
    HotspotOut,
    PipelineTriggerResponse,
    SearchResult,
    StateCount,
    StatsOut,
    PipelineStatus,
)

router = APIRouter(prefix="/intelligence", tags=["intelligence-pipeline"])


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------

@router.get("/events", response_model=CrimeEventList, summary="List crime events")
def list_events(
    state: Optional[str] = Query(None, description="Filter by Indian state"),
    district: Optional[str] = Query(None, description="Filter by district"),
    city: Optional[str] = Query(None, description="Filter by city"),
    crime_type: Optional[str] = Query(None, description="Filter by crime type"),
    date_from: Optional[datetime] = Query(None, description="Incidents on or after this date"),
    date_to: Optional[datetime] = Query(None, description="Incidents on or before this date"),
    min_money_lost: Optional[float] = Query(None, description="Minimum money lost (INR)"),
    has_coordinates: Optional[bool] = Query(None, description="Only return geocoded events"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> CrimeEventList:
    q = db.query(CrimeEvent)

    if state:
        q = q.filter(func.lower(CrimeEvent.state) == state.lower())
    if district:
        q = q.filter(func.lower(CrimeEvent.district) == district.lower())
    if city:
        q = q.filter(func.lower(CrimeEvent.city) == city.lower())
    if crime_type:
        q = q.filter(func.lower(CrimeEvent.crime_type) == crime_type.lower())
    if date_from:
        q = q.filter(CrimeEvent.incident_date >= date_from)
    if date_to:
        q = q.filter(CrimeEvent.incident_date <= date_to)
    if min_money_lost is not None:
        q = q.filter(CrimeEvent.money_lost_inr >= min_money_lost)
    if has_coordinates is True:
        q = q.filter(
            CrimeEvent.latitude.is_not(None),
            CrimeEvent.longitude.is_not(None),
        )

    total = q.count()
    items = (
        q.order_by(CrimeEvent.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return CrimeEventList(
        total=total,
        limit=limit,
        offset=offset,
        items=[CrimeEventOut.model_validate(e) for e in items],
    )


@router.get(
    "/events/{event_id}",
    response_model=CrimeEventOut,
    summary="Get single crime event",
)
def get_event(event_id: str, db: Session = Depends(get_db)) -> CrimeEventOut:
    event = db.query(CrimeEvent).filter(CrimeEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return CrimeEventOut.model_validate(event)


# ---------------------------------------------------------------------------
# Hotspots
# ---------------------------------------------------------------------------

@router.get("/hotspots", response_model=HotspotList, summary="City-level risk hotspots")
def list_hotspots(
    state: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(
        None, description="Filter by risk level: low|medium|high|critical"
    ),
    min_risk_score: Optional[float] = Query(None, ge=0, le=100),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> HotspotList:
    q = db.query(Hotspot)

    if state:
        q = q.filter(func.lower(Hotspot.state) == state.lower())
    if risk_level:
        q = q.filter(Hotspot.risk_level == risk_level.lower())
    if min_risk_score is not None:
        q = q.filter(Hotspot.risk_score >= min_risk_score)

    items = q.order_by(Hotspot.risk_score.desc()).limit(limit).all()
    total = q.count()

    return HotspotList(
        total=total,
        items=[HotspotOut.model_validate(h) for h in items],
    )


# ---------------------------------------------------------------------------
# Statistics
# ---------------------------------------------------------------------------

@router.get("/stats", response_model=StatsOut, summary="Aggregate dashboard statistics")
def get_stats(db: Session = Depends(get_db)) -> StatsOut:
    now = datetime.now(timezone.utc)
    cutoff_30d = now - timedelta(days=30)

    total_events = db.query(func.count(CrimeEvent.id)).scalar() or 0
    total_events_30d = (
        db.query(func.count(CrimeEvent.id))
        .filter(CrimeEvent.created_at >= cutoff_30d)
        .scalar()
        or 0
    )

    money_result = db.query(func.sum(CrimeEvent.money_lost_inr)).scalar()
    total_money = float(money_result) if money_result else 0.0

    victim_result = db.query(func.sum(CrimeEvent.victim_count)).scalar()
    total_victims = int(victim_result) if victim_result else 0

    # Top crime types
    crime_rows = (
        db.query(
            CrimeEvent.crime_type,
            func.count(CrimeEvent.id).label("cnt"),
            func.coalesce(func.sum(CrimeEvent.money_lost_inr), 0).label("money"),
        )
        .filter(CrimeEvent.crime_type.is_not(None))
        .group_by(CrimeEvent.crime_type)
        .order_by(func.count(CrimeEvent.id).desc())
        .limit(10)
        .all()
    )
    top_crime_types = [
        CrimeTypeCount(crime_type=r[0], count=r[1], total_money_lost_inr=float(r[2]))
        for r in crime_rows
    ]

    # Top states
    state_rows = (
        db.query(
            Hotspot.state,
            func.sum(Hotspot.incident_count).label("cnt"),
            func.avg(Hotspot.risk_score).label("risk"),
        )
        .filter(Hotspot.state.is_not(None))
        .group_by(Hotspot.state)
        .order_by(func.sum(Hotspot.incident_count).desc())
        .limit(10)
        .all()
    )
    top_states = [
        StateCount(state=r[0], count=int(r[1] or 0), risk_score=round(float(r[2] or 0), 2))
        for r in state_rows
    ]

    # Most recent incident
    latest = (
        db.query(func.max(CrimeEvent.incident_date)).scalar()
    )

    # Pipeline status
    sched_status = get_scheduler_status()
    total_raw = db.query(func.count(RawArticle.id)).scalar() or 0
    total_geocoded = (
        db.query(func.count(CrimeEvent.id))
        .filter(CrimeEvent.latitude.is_not(None))
        .scalar()
        or 0
    )
    total_hotspots = db.query(func.count(Hotspot.id)).scalar() or 0

    pipeline = PipelineStatus(
        last_run_at=sched_status["last_run_at"],
        last_run_status=sched_status["last_run_status"],
        total_articles_collected=total_raw,
        total_events_geocoded=total_geocoded,
        total_hotspots_computed=total_hotspots,
        scheduler_running=sched_status["running"],
    )

    return StatsOut(
        total_events=total_events,
        total_events_last_30_days=total_events_30d,
        total_money_lost_inr=total_money,
        total_victims=total_victims,
        top_crime_types=top_crime_types,
        top_states=top_states,
        most_recent_incident=latest,
        pipeline=pipeline,
    )


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

@router.get("/search", response_model=SearchResult, summary="Full-text search across events")
def search_events(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> SearchResult:
    query_lower = f"%{q.lower()}%"

    events = (
        db.query(CrimeEvent)
        .filter(
            or_(
                func.lower(CrimeEvent.title).like(query_lower),
                func.lower(CrimeEvent.summary).like(query_lower),
                func.lower(CrimeEvent.city).like(query_lower),
                func.lower(CrimeEvent.state).like(query_lower),
                func.lower(CrimeEvent.crime_type).like(query_lower),
            )
        )
        .order_by(CrimeEvent.created_at.desc())
        .limit(limit)
        .all()
    )

    return SearchResult(
        query=q,
        total=len(events),
        items=[CrimeEventOut.model_validate(e) for e in events],
    )


# ---------------------------------------------------------------------------
# Pipeline trigger (manual)
# ---------------------------------------------------------------------------

@router.post(
    "/pipeline/run",
    response_model=PipelineTriggerResponse,
    summary="Manually trigger the intelligence pipeline",
    tags=["admin"],
)
def trigger_pipeline(
    background_tasks: BackgroundTasks,
) -> PipelineTriggerResponse:
    """Trigger a full pipeline run asynchronously."""
    run_id = str(uuid.uuid4())
    background_tasks.add_task(run_pipeline, run_id)

    return PipelineTriggerResponse(
        message="Pipeline run queued. Check /intelligence/stats for status.",
        run_id=run_id,
        triggered_at=datetime.now(timezone.utc),
    )
