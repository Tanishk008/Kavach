"""Intelligence pipeline SQLAlchemy ORM models.

Tables:
    raw_articles       — raw JSON fetched from news APIs / RSS feeds
    processed_articles — AI-extracted structured fields per article
    crime_events       — geocoded, deduplicated incidents (with lat/lng)
    hotspots           — aggregated city-level cyber-risk scores (0-100)
    scheduler_logs     — per-run audit log for the 6-step pipeline
    source_logs        — per-source collection stats per run
    geocode_cache      — Nominatim / Google geocoding cache
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


# ---------------------------------------------------------------------------
# 1. RAW ARTICLES
# ---------------------------------------------------------------------------

class RawArticle(Base):
    """Raw JSON payload from a news API or RSS feed, before any processing."""

    __tablename__ = "raw_articles"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    source_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    """e.g. 'gnews', 'newsapi', 'cert_in_rss', 'i4c_rss'"""

    url: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    """Canonical article URL — used as dedup key at collection time."""

    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    raw_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    """Full API response payload stored for audit / reprocessing."""

    is_processed: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    """Set to True after the extractor has processed this article."""

    fetch_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    """Non-null when the article fetch / parse failed."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


# ---------------------------------------------------------------------------
# 2. PROCESSED ARTICLES
# ---------------------------------------------------------------------------

class ProcessedArticle(Base):
    """AI-extracted structured fields from a raw article."""

    __tablename__ = "processed_articles"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    raw_article_id: Mapped[str] = mapped_column(
        ForeignKey("raw_articles.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # -- Core extracted fields --
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    crime_type: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    """e.g. 'UPI Scam', 'Digital Arrest', 'Phishing'"""

    subcategory: Mapped[str | None] = mapped_column(String(80), nullable=True)

    incident_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    # -- Location --
    state: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    district: Mapped[str | None] = mapped_column(String(80), nullable=True)
    city: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)

    # -- Financial / victim data --
    money_lost_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    victim_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    suspect_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # -- Provenance --
    source_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    """Extractor's confidence in the extracted data (0-1)."""

    extraction_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    """Non-null when Gemini extraction failed."""

    # -- Deduplication --
    is_duplicate: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    duplicate_of_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True
    )
    """Points to the canonical ProcessedArticle.id this is a duplicate of."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


# ---------------------------------------------------------------------------
# 3. CRIME EVENTS
# ---------------------------------------------------------------------------

class CrimeEvent(Base):
    """A geocoded, deduplicated cybercrime incident ready for the API and map."""

    __tablename__ = "crime_events"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    processed_article_id: Mapped[str | None] = mapped_column(
        ForeignKey("processed_articles.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
        index=True,
    )

    # -- Structured fields (denormalized for query performance) --
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    crime_type: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    subcategory: Mapped[str | None] = mapped_column(String(80), nullable=True)
    incident_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    # -- Location --
    state: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    district: Mapped[str | None] = mapped_column(String(80), nullable=True)
    city: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)

    # -- Geocoordinates --
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    # -- Financials --
    money_lost_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    victim_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    suspect_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # -- Provenance --
    source_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    # -- Risk --
    severity_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    """Per-event severity (0-100), feeds hotspot risk calculation."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


# ---------------------------------------------------------------------------
# 4. HOTSPOTS
# ---------------------------------------------------------------------------

class Hotspot(Base):
    """Aggregated city-level cyber-risk score, updated every pipeline cycle."""

    __tablename__ = "hotspots"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    city: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    district: Mapped[str | None] = mapped_column(String(80), nullable=True)
    state: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)

    # -- Geocoordinates (representative point for the city) --
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    # -- Risk score --
    risk_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    """Normalized 0-100 composite risk score."""

    risk_level: Mapped[str] = mapped_column(String(16), nullable=False, default="low")
    """'low' | 'medium' | 'high' | 'critical'"""

    # -- Aggregated counts (for the score computation window) --
    incident_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    recent_incident_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    """Count in last 30 days."""

    total_money_lost_inr: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    avg_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    top_crime_types: Mapped[list | None] = mapped_column(JSON, nullable=True)
    """Top 3 crime types by frequency, e.g. ['UPI Scam', 'Phishing']"""

    # -- Timestamps --
    last_incident_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    __table_args__ = (UniqueConstraint("city", "state", name="uq_hotspot_city_state"),)


# ---------------------------------------------------------------------------
# 5. SCHEDULER LOGS
# ---------------------------------------------------------------------------

class SchedulerLog(Base):
    """Audit log for each pipeline execution cycle."""

    __tablename__ = "scheduler_logs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    run_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    """UUID shared by all steps in a single pipeline run."""

    step: Mapped[str] = mapped_column(String(64), nullable=False)
    """e.g. 'collect', 'extract', 'geocode', 'deduplicate', 'risk', 'api_refresh'"""

    status: Mapped[str] = mapped_column(String(16), nullable=False)
    """'started' | 'success' | 'error' | 'skipped'"""

    items_processed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    items_failed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


# ---------------------------------------------------------------------------
# 6. SOURCE LOGS
# ---------------------------------------------------------------------------

class SourceLog(Base):
    """Per-source collection stats per scheduler run."""

    __tablename__ = "source_logs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    run_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    source_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    articles_fetched: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    articles_new: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    articles_skipped: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


# ---------------------------------------------------------------------------
# 7. GEOCODE CACHE
# ---------------------------------------------------------------------------

class GeocodeCache(Base):
    """Cache for Nominatim / Google geocoding results."""

    __tablename__ = "geocode_cache"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    query: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    """Normalized location string used as cache key."""

    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    display_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False, default="nominatim")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
