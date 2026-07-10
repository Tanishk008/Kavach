"""Risk scoring engine — computes city-level cyber risk scores (0-100).

Factors (weighted):
    1. Recent incident count (last 30 days)    — weight 35%
    2. Severity (money lost, victim count)     — weight 25%
    3. Historical frequency (6-month baseline) — weight 20%
    4. Source confidence                       — weight 10%
    5. Crime type severity mix                 — weight 10%

Score is normalized to 0-100 and stored in the hotspots table.
Risk levels: 0-25 = low, 26-50 = medium, 51-75 = high, 76-100 = critical
"""
from __future__ import annotations

import logging
import math
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.intelligence import CrimeEvent, Hotspot

logger = logging.getLogger(__name__)

RECENT_WINDOW_DAYS = 30
HISTORICAL_WINDOW_DAYS = 180

# Crime type severity multipliers (1.0 = baseline)
CRIME_SEVERITY_WEIGHTS = {
    "Digital Arrest": 1.8,
    "Investment Scam": 1.7,
    "Crypto Scam": 1.6,
    "Ransomware": 1.6,
    "Cyber Extortion": 1.5,
    "Sextortion": 1.5,
    "Online Banking Fraud": 1.4,
    "UPI Scam": 1.3,
    "Credit Card Fraud": 1.3,
    "Phishing": 1.2,
    "OTP Fraud": 1.2,
    "WhatsApp Scam": 1.1,
    "Loan App Fraud": 1.1,
    "Vishing": 1.0,
    "SIM Swap": 1.0,
    "Job Fraud": 0.9,
    "Lottery Fraud": 0.9,
}


def _risk_level(score: float) -> str:
    if score >= 76:
        return "critical"
    if score >= 51:
        return "high"
    if score >= 26:
        return "medium"
    return "low"


def _make_naive(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


class RiskEngine:
    """Computes and persists city-level hotspot risk scores."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def compute_all(self) -> int:
        """Recompute risk scores for all cities with events.

        Returns:
            Number of hotspots updated.
        """
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        recent_cutoff = now - timedelta(days=RECENT_WINDOW_DAYS)
        historical_cutoff = now - timedelta(days=HISTORICAL_WINDOW_DAYS)

        # Get all unique cities with events
        cities = (
            self.db.query(
                CrimeEvent.city,
                CrimeEvent.state,
            )
            .filter(CrimeEvent.city.is_not(None))
            .distinct()
            .all()
        )

        updated = 0
        for city, state in cities:
            try:
                self._compute_city(city, state, now, recent_cutoff, historical_cutoff)
                updated += 1
            except Exception as exc:
                logger.warning("[risk] Failed to compute score for %s: %s", city, exc)

        self.db.commit()
        logger.info("[risk] Hotspots updated: %d", updated)
        return updated

    def _compute_city(
        self,
        city: str,
        state: Optional[str],
        now: datetime,
        recent_cutoff: datetime,
        historical_cutoff: datetime,
    ) -> None:
        """Compute and upsert hotspot for one city."""

        # Fetch all events for this city
        all_events = (
            self.db.query(CrimeEvent)
            .filter(
                CrimeEvent.city == city,
                CrimeEvent.created_at >= historical_cutoff,
            )
            .all()
        )

        if not all_events:
            return

        recent_events = [
            e for e in all_events
            if e.created_at and _make_naive(e.created_at) >= recent_cutoff
        ]

        # --- Factor 1: Recent incident count (35%) ---
        recent_count = len(recent_events)
        # Log scale to prevent mega-cities from dominating infinitely
        f1 = min(100, math.log1p(recent_count) * 25)

        # --- Factor 2: Severity (25%) ---
        total_money = sum(e.money_lost_inr or 0 for e in all_events)
        total_victims = sum(e.victim_count or 0 for e in all_events)
        avg_severity = (
            sum(e.severity_score or 0 for e in all_events) / len(all_events)
        )
        f2 = min(100, avg_severity)

        # --- Factor 3: Historical frequency (20%) ---
        historical_count = len(all_events)
        f3 = min(100, math.log1p(historical_count) * 20)

        # --- Factor 4: Source confidence (10%) ---
        confidences = [e.confidence for e in all_events if e.confidence is not None]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.5
        f4 = avg_confidence * 100

        # --- Factor 5: Crime type severity mix (10%) ---
        crime_weights = [
            CRIME_SEVERITY_WEIGHTS.get(e.crime_type, 1.0)
            for e in recent_events if e.crime_type
        ]
        avg_crime_weight = (
            sum(crime_weights) / len(crime_weights) if crime_weights else 1.0
        )
        f5 = min(100, avg_crime_weight * 50)

        # --- Weighted composite score ---
        raw_score = (
            f1 * 0.35
            + f2 * 0.25
            + f3 * 0.20
            + f4 * 0.10
            + f5 * 0.10
        )
        risk_score = round(min(100.0, raw_score), 2)

        # Top crime types
        crime_counter = Counter(
            e.crime_type for e in recent_events if e.crime_type
        )
        top_crime_types = [ct for ct, _ in crime_counter.most_common(3)]

        # Representative coordinates (use the first geocoded event)
        lat = lng = None
        for e in all_events:
            if e.latitude and e.longitude:
                lat, lng = e.latitude, e.longitude
                break

        # Last incident
        last_incident = max(
            (_make_naive(e.incident_date or e.created_at) for e in all_events if e.incident_date or e.created_at),
            default=None,
        )

        # Upsert hotspot
        existing = (
            self.db.query(Hotspot)
            .filter(Hotspot.city == city, Hotspot.state == state)
            .first()
        )

        if existing:
            existing.risk_score = risk_score
            existing.risk_level = _risk_level(risk_score)
            existing.incident_count = historical_count
            existing.recent_incident_count = recent_count
            existing.total_money_lost_inr = total_money
            existing.avg_confidence = round(avg_confidence, 3)
            existing.top_crime_types = top_crime_types
            existing.latitude = lat or existing.latitude
            existing.longitude = lng or existing.longitude
            existing.last_incident_at = last_incident
            from datetime import datetime, timezone
            existing.computed_at = datetime.now(timezone.utc)
        else:
            hotspot = Hotspot(
                city=city,
                state=state,
                latitude=lat,
                longitude=lng,
                risk_score=risk_score,
                risk_level=_risk_level(risk_score),
                incident_count=historical_count,
                recent_incident_count=recent_count,
                total_money_lost_inr=total_money,
                avg_confidence=round(avg_confidence, 3),
                top_crime_types=top_crime_types,
                last_incident_at=last_incident,
            )
            self.db.add(hotspot)
