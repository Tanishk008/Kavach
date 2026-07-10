"""Deduplication engine — merges articles referring to the same incident.

Strategy (applied in order):
    1. URL exact match (already handled at collection time via unique constraint)
    2. TF-IDF cosine similarity on headlines > 0.85 threshold
    3. Same city + crime_type + date (within a 3-day window)

Duplicate articles are marked with is_duplicate=True and point to the
canonical (first-seen) article via duplicate_of_id.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.intelligence import ProcessedArticle

logger = logging.getLogger(__name__)

SIMILARITY_THRESHOLD = 0.80  # cosine similarity threshold for headline dedup
DATE_WINDOW_DAYS = 3  # max days between incidents to be considered same


class Deduplicator:
    """Marks duplicate ProcessedArticle records."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self._vectorizer = None
        self._init_vectorizer()

    def _init_vectorizer(self) -> None:
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            self._vectorizer = TfidfVectorizer(
                stop_words="english",
                ngram_range=(1, 2),
                min_df=1,
                max_features=5000,
            )
        except ImportError:
            logger.warning(
                "[dedup] scikit-learn not installed — TF-IDF dedup disabled."
            )

    def deduplicate(self) -> int:
        """Run deduplication pass across unprocessed articles.

        Returns:
            Number of duplicates marked.
        """
        # Only operate on non-duplicate articles with titles
        articles = (
            self.db.query(ProcessedArticle)
            .filter(
                ProcessedArticle.is_duplicate == False,  # noqa: E712
                ProcessedArticle.title.is_not(None),
            )
            .order_by(ProcessedArticle.created_at.asc())
            .all()
        )

        if len(articles) < 2:
            return 0

        duplicates_marked = 0

        # --- Pass 1: TF-IDF cosine similarity on titles ---
        if self._vectorizer and len(articles) >= 2:
            duplicates_marked += self._tfidf_dedup(articles)

        # --- Pass 2: Same city + crime_type + date window ---
        # Re-fetch to get updated is_duplicate flags
        articles = (
            self.db.query(ProcessedArticle)
            .filter(ProcessedArticle.is_duplicate == False)  # noqa: E712
            .order_by(ProcessedArticle.created_at.asc())
            .all()
        )
        duplicates_marked += self._location_date_dedup(articles)

        self.db.commit()
        logger.info("[dedup] Duplicates marked: %d", duplicates_marked)
        return duplicates_marked

    def _tfidf_dedup(self, articles: list[ProcessedArticle]) -> int:
        """TF-IDF cosine similarity deduplication on article titles."""
        import numpy as np
        from sklearn.metrics.pairwise import cosine_similarity

        titles = [self._normalize_title(a.title or "") for a in articles]
        try:
            matrix = self._vectorizer.fit_transform(titles)
        except ValueError:
            return 0

        sim_matrix = cosine_similarity(matrix)
        marked = 0

        for i in range(len(articles)):
            if articles[i].is_duplicate:
                continue
            for j in range(i + 1, len(articles)):
                if articles[j].is_duplicate:
                    continue
                if sim_matrix[i, j] >= SIMILARITY_THRESHOLD:
                    # Mark the later article as a duplicate of the earlier one
                    articles[j].is_duplicate = True
                    articles[j].duplicate_of_id = articles[i].id
                    marked += 1
                    logger.debug(
                        "[dedup] TF-IDF duplicate: '%s' ≈ '%s' (%.2f)",
                        articles[j].title[:60], articles[i].title[:60], sim_matrix[i, j],
                    )

        return marked

    def _location_date_dedup(self, articles: list[ProcessedArticle]) -> int:
        """Dedup based on matching city + crime_type within a 3-day window."""
        marked = 0

        for i in range(len(articles)):
            if articles[i].is_duplicate:
                continue
            a = articles[i]

            for j in range(i + 1, len(articles)):
                if articles[j].is_duplicate:
                    continue
                b = articles[j]

                # Must have city and crime_type to compare
                if not (a.city and b.city and a.crime_type and b.crime_type):
                    continue

                city_match = a.city.lower() == b.city.lower()
                type_match = a.crime_type.lower() == b.crime_type.lower()

                if not (city_match and type_match):
                    continue

                # Check date proximity
                date_match = self._dates_close(a.incident_date, b.incident_date)
                if date_match:
                    b.is_duplicate = True
                    b.duplicate_of_id = a.id
                    marked += 1
                    logger.debug(
                        "[dedup] Location+date duplicate: %s in %s ≈ %s in %s",
                        b.crime_type, b.city, a.crime_type, a.city,
                    )

        return marked

    @staticmethod
    def _normalize_title(title: str) -> str:
        """Lowercase, remove punctuation, collapse whitespace."""
        title = title.lower()
        title = re.sub(r"[^\w\s]", " ", title)
        title = re.sub(r"\s+", " ", title).strip()
        return title

    @staticmethod
    def _dates_close(
        date_a: Optional[datetime], date_b: Optional[datetime]
    ) -> bool:
        """True if both dates are within DATE_WINDOW_DAYS of each other."""
        if date_a is None or date_b is None:
            return False
        if date_a.tzinfo is None:
            date_a = date_a.replace(tzinfo=timezone.utc)
        if date_b.tzinfo is None:
            date_b = date_b.replace(tzinfo=timezone.utc)
        return abs((date_a - date_b).days) <= DATE_WINDOW_DAYS
