"""Abstract base collector with retry logic, rate limiting, and structured logging."""
from __future__ import annotations

import logging
import time
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy.orm import Session
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.models.intelligence import RawArticle, SourceLog

logger = logging.getLogger(__name__)

# Cybercrime search terms used by all news API collectors
CYBERCRIME_SEARCH_TERMS = [
    "Cyber Fraud India",
    "UPI Scam India",
    "Digital Arrest India",
    "OTP Fraud India",
    "Investment Scam India",
    "Loan App Fraud India",
    "Phishing India",
    "Vishing India",
    "WhatsApp Scam India",
    "SIM Swap India",
    "Crypto Scam India",
    "Online Banking Fraud India",
    "Credit Card Fraud India",
    "Cyber Crime India",
]


class BaseCollector(ABC):
    """Abstract base for all news / feed collectors.

    Subclasses must implement:
        - ``source_name`` property
        - ``_fetch_articles`` method returning list of raw article dicts
    """

    # HTTP client timeout settings
    HTTP_TIMEOUT = 20.0
    REQUEST_DELAY = 0.5  # seconds between requests

    def __init__(self, db: Session, run_id: str | None = None) -> None:
        self.db = db
        self.run_id = run_id or str(uuid.uuid4())
        self._http = httpx.Client(
            timeout=self.HTTP_TIMEOUT,
            headers={"User-Agent": "KavachIntelligence/1.0 (cybercrime research; contact@kavach.ai)"},
            follow_redirects=True,
        )

    def __del__(self) -> None:
        try:
            self._http.close()
        except Exception:
            pass

    @property
    @abstractmethod
    def source_name(self) -> str:
        """Unique string identifier for this source, e.g. 'gnews'."""

    @abstractmethod
    def _fetch_articles(self) -> list[dict[str, Any]]:
        """Fetch raw article payloads from the source.

        Returns:
            List of dicts with at minimum: 'url', 'title', 'published_at',
            and 'raw_json' keys.
        """

    def collect(self) -> tuple[int, int, int]:
        """Run collection and persist to DB.

        Returns:
            (fetched_count, new_count, skipped_count)
        """
        fetched = new = skipped = 0
        error_msg: str | None = None

        try:
            articles = self._fetch_articles()
            fetched = len(articles)

            seen_urls = set()
            for art in articles:
                url = art.get("url", "").strip()
                if not url:
                    skipped += 1
                    continue

                if url in seen_urls:
                    skipped += 1
                    continue

                # Dedup by URL in database
                existing = (
                    self.db.query(RawArticle).filter(RawArticle.url == url).first()
                )
                if existing:
                    skipped += 1
                    continue

                seen_urls.add(url)
                raw = RawArticle(
                    source_name=self.source_name,
                    url=url,
                    title=art.get("title"),
                    published_at=art.get("published_at"),
                    raw_json=art.get("raw_json"),
                    is_processed=False,
                )
                self.db.add(raw)
                new += 1

            self.db.commit()

        except Exception as exc:
            self.db.rollback()
            error_msg = str(exc)
            logger.exception("[%s] Collection failed: %s", self.source_name, exc)

        finally:
            self._log_source(fetched, new, skipped, error_msg)

        logger.info(
            "[%s] fetched=%d new=%d skipped=%d",
            self.source_name, fetched, new, skipped,
        )
        return fetched, new, skipped

    def _log_source(
        self,
        fetched: int,
        new: int,
        skipped: int,
        error: str | None,
    ) -> None:
        """Persist a SourceLog record for this collection run."""
        try:
            log = SourceLog(
                run_id=self.run_id,
                source_name=self.source_name,
                articles_fetched=fetched,
                articles_new=new,
                articles_skipped=skipped,
                error_message=error,
            )
            self.db.add(log)
            self.db.commit()
        except Exception:
            self.db.rollback()

    def _throttle(self) -> None:
        """Simple rate-limit courtesy delay."""
        time.sleep(self.REQUEST_DELAY)

    @staticmethod
    def _parse_iso(date_str: str | None) -> datetime | None:
        """Best-effort ISO-8601 parser returning UTC datetime or None."""
        if not date_str:
            return None
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            return None


@retry(
    retry=retry_if_exception_type(httpx.HTTPError),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    reraise=True,
)
def http_get_with_retry(client: httpx.Client, url: str, **kwargs) -> httpx.Response:
    """GET with exponential back-off retries on transient HTTP errors."""
    response = client.get(url, **kwargs)
    response.raise_for_status()
    return response
