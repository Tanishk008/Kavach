"""Pydantic schemas for the intelligence pipeline REST API."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Crime Event schemas
# ---------------------------------------------------------------------------

class CrimeEventOut(BaseModel):
    """Public-facing representation of a single geocoded crime incident."""

    id: str
    title: Optional[str] = None
    summary: Optional[str] = None
    crime_type: Optional[str] = None
    subcategory: Optional[str] = None
    incident_date: Optional[datetime] = None

    # Location
    state: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    # Financials
    money_lost_inr: Optional[float] = None
    victim_count: Optional[int] = None
    suspect_count: Optional[int] = None

    # Provenance
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    confidence: Optional[float] = None
    severity_score: Optional[float] = None

    created_at: datetime

    model_config = {"from_attributes": True}


class CrimeEventList(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[CrimeEventOut]


# ---------------------------------------------------------------------------
# Hotspot schemas
# ---------------------------------------------------------------------------

class HotspotOut(BaseModel):
    """City-level risk hotspot, including coordinates for the map layer."""

    id: str
    city: str
    district: Optional[str] = None
    state: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    risk_score: float = Field(ge=0, le=100)
    risk_level: str  # low | medium | high | critical

    incident_count: int
    recent_incident_count: int
    total_money_lost_inr: float
    avg_confidence: Optional[float] = None
    top_crime_types: Optional[list[str]] = None
    last_incident_at: Optional[datetime] = None
    computed_at: datetime

    model_config = {"from_attributes": True}


class HotspotList(BaseModel):
    total: int
    items: list[HotspotOut]


# ---------------------------------------------------------------------------
# Stats schemas
# ---------------------------------------------------------------------------

class CrimeTypeCount(BaseModel):
    crime_type: str
    count: int
    total_money_lost_inr: float


class StateCount(BaseModel):
    state: str
    count: int
    risk_score: float


class PipelineStatus(BaseModel):
    last_run_at: Optional[datetime] = None
    last_run_status: Optional[str] = None
    total_articles_collected: int
    total_events_geocoded: int
    total_hotspots_computed: int
    scheduler_running: bool


class StatsOut(BaseModel):
    """Aggregate statistics for the dashboard."""

    total_events: int
    total_events_last_30_days: int
    total_money_lost_inr: float
    total_victims: int
    top_crime_types: list[CrimeTypeCount]
    top_states: list[StateCount]
    most_recent_incident: Optional[datetime] = None
    pipeline: PipelineStatus


# ---------------------------------------------------------------------------
# Search schema
# ---------------------------------------------------------------------------

class SearchResult(BaseModel):
    query: str
    total: int
    items: list[CrimeEventOut]


# ---------------------------------------------------------------------------
# Pipeline trigger response
# ---------------------------------------------------------------------------

class PipelineTriggerResponse(BaseModel):
    message: str
    run_id: str
    triggered_at: datetime
