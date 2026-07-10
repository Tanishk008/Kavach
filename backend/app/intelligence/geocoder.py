"""Geocoder — converts city/state strings to lat/lng coordinates.

Primary: OpenStreetMap Nominatim (free, 1 req/sec rate limit)
Fallback: Google Geocoding API (if GOOGLE_GEOCODING_API_KEY is set)

Results are cached in the geocode_cache table to avoid redundant API calls.
All queries are restricted to India (countrycodes=IN).
"""
from __future__ import annotations

import logging
import time
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.intelligence import CrimeEvent, GeocodeCache, ProcessedArticle

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"

# Nominatim requires 1 second between requests per their usage policy
NOMINATIM_DELAY = 1.1


class Geocoder:
    """Geocodes city/state location strings and persists to crime_events."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self._settings = get_settings()
        self._http = httpx.Client(
            timeout=15.0,
            headers={
                "User-Agent": "KavachIntelligence/1.0 (cybercrime research; contact@kavach.ai)"
            },
        )

    def __del__(self) -> None:
        try:
            self._http.close()
        except Exception:
            pass

    def geocode_pending(self, limit: int = 100) -> tuple[int, int]:
        """Create CrimeEvents for all ProcessedArticles not yet geocoded.

        Returns:
            (geocoded_count, skipped_count)
        """
        # Get processed articles that haven't been turned into crime events yet
        already_done = {
            row[0]
            for row in self.db.query(CrimeEvent.processed_article_id).all()
        }

        pending = (
            self.db.query(ProcessedArticle)
            .filter(
                ProcessedArticle.is_duplicate == False,  # noqa: E712
                ProcessedArticle.extraction_error.is_(None),
            )
            .limit(limit)
            .all()
        )

        geocoded = skipped = 0
        for article in pending:
            if article.id in already_done:
                skipped += 1
                continue

            lat, lng = self._resolve_coordinates(article)

            event = CrimeEvent(
                processed_article_id=article.id,
                title=article.title,
                summary=article.summary,
                crime_type=article.crime_type,
                subcategory=article.subcategory,
                incident_date=article.incident_date,
                state=article.state,
                district=article.district,
                city=article.city,
                latitude=lat,
                longitude=lng,
                money_lost_inr=article.money_lost_inr,
                victim_count=article.victim_count,
                suspect_count=article.suspect_count,
                source_name=article.source_name,
                source_url=article.source_url,
                confidence=article.confidence,
                severity_score=self._compute_severity(article),
            )
            self.db.add(event)
            geocoded += 1

            if geocoded % 20 == 0:
                self.db.commit()

        self.db.commit()
        logger.info("[geocoder] Geocoded: %d, Skipped: %d", geocoded, skipped)
        return geocoded, skipped

    def _resolve_coordinates(
        self, article: ProcessedArticle
    ) -> tuple[Optional[float], Optional[float]]:
        """Return (lat, lng) for the article's location, using cache first."""
        if not article.city and not article.state:
            return None, None

        query = self._build_query(article.city, article.district, article.state)
        cached = self._check_cache(query)
        if cached:
            return cached

        lat, lng = self._nominatim_geocode(query)
        if lat is None and self._settings.google_geocoding_api_key:
            lat, lng = self._google_geocode(query)

        self._save_cache(query, lat, lng)
        return lat, lng

    def _nominatim_geocode(
        self, query: str
    ) -> tuple[Optional[float], Optional[float]]:
        """Geocode via OpenStreetMap Nominatim with rate-limit delay."""
        try:
            time.sleep(NOMINATIM_DELAY)
            resp = self._http.get(
                NOMINATIM_URL,
                params={
                    "q": query,
                    "format": "json",
                    "limit": 1,
                    "countrycodes": "IN",
                    "addressdetails": 0,
                },
            )
            resp.raise_for_status()
            results = resp.json()
            if results:
                return float(results[0]["lat"]), float(results[0]["lon"])
        except Exception as exc:
            logger.warning("[geocoder] Nominatim failed for '%s': %s", query, exc)
        return None, None

    def _google_geocode(
        self, query: str
    ) -> tuple[Optional[float], Optional[float]]:
        """Geocode via Google Geocoding API (fallback)."""
        try:
            resp = self._http.get(
                GOOGLE_GEOCODE_URL,
                params={
                    "address": query + ", India",
                    "key": self._settings.google_geocoding_api_key,
                    "components": "country:IN",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("status") == "OK" and data.get("results"):
                loc = data["results"][0]["geometry"]["location"]
                return float(loc["lat"]), float(loc["lng"])
        except Exception as exc:
            logger.warning("[geocoder] Google geocode failed for '%s': %s", query, exc)
        return None, None

    def _check_cache(
        self, query: str
    ) -> tuple[Optional[float], Optional[float]] | None:
        """Return cached coordinates or None."""
        cached = (
            self.db.query(GeocodeCache)
            .filter(GeocodeCache.query == query)
            .first()
        )
        if cached:
            return cached.latitude, cached.longitude
        return None

    def _save_cache(
        self, query: str, lat: Optional[float], lng: Optional[float]
    ) -> None:
        """Persist geocoding result to cache table."""
        try:
            existing = (
                self.db.query(GeocodeCache)
                .filter(GeocodeCache.query == query)
                .first()
            )
            if existing:
                return
            cache_entry = GeocodeCache(
                query=query,
                latitude=lat,
                longitude=lng,
                provider="nominatim",
            )
            self.db.add(cache_entry)
            self.db.commit()
        except Exception:
            self.db.rollback()

    @staticmethod
    def _build_query(
        city: Optional[str],
        district: Optional[str],
        state: Optional[str],
    ) -> str:
        """Build a clean geocoding query string."""
        parts = [p for p in [city, district, state] if p]
        return ", ".join(parts)

    @staticmethod
    def _compute_severity(article: ProcessedArticle) -> float:
        """Compute a per-event severity score (0-100) based on article data."""
        score = 20.0  # base

        # Money lost factor (logarithmic scale)
        if article.money_lost_inr:
            import math
            score += min(30, math.log10(max(1, article.money_lost_inr)) * 3)

        # Victim count factor
        if article.victim_count:
            score += min(20, article.victim_count * 2)

        # Crime type severity weights
        high_severity = {
            "Digital Arrest", "Investment Scam", "Ransomware",
            "Cyber Extortion", "Sextortion", "Crypto Scam",
        }
        medium_severity = {
            "UPI Scam", "Online Banking Fraud", "Credit Card Fraud",
            "Phishing", "OTP Fraud", "WhatsApp Scam",
        }
        if article.crime_type in high_severity:
            score += 20
        elif article.crime_type in medium_severity:
            score += 10

        # Confidence factor
        if article.confidence:
            score *= article.confidence

        return min(100.0, round(score, 2))
