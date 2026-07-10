"""GNews API collector.

GNews API docs: https://gnews.io/docs/v4
Free tier: 100 requests/day, 10 articles per request.

We rotate through CYBERCRIME_SEARCH_TERMS to maximize article diversity.
To stay within the free quota we cap total requests per run to 10.
"""
from __future__ import annotations

import logging
from typing import Any

from app.config import get_settings
from app.intelligence.collectors.base_collector import (
    CYBERCRIME_SEARCH_TERMS,
    BaseCollector,
    http_get_with_retry,
)

logger = logging.getLogger(__name__)

GNEWS_API_URL = "https://gnews.io/api/v4/search"
MAX_REQUESTS_PER_RUN = 10  # stay within free-tier daily quota
ARTICLES_PER_REQUEST = 10


class GNewsCollector(BaseCollector):
    """Fetches cybercrime articles from the GNews API."""

    source_name = "gnews"

    def __init__(self, db, run_id=None) -> None:
        super().__init__(db, run_id)
        self._settings = get_settings()
        self._api_key = self._settings.gnews_api_key

    def _fetch_articles(self) -> list[dict[str, Any]]:
        if not self._api_key:
            logger.warning("[gnews] GNEWS_API_KEY not configured — skipping.")
            return []

        all_articles: list[dict[str, Any]] = []
        terms_to_use = CYBERCRIME_SEARCH_TERMS[:MAX_REQUESTS_PER_RUN]

        for term in terms_to_use:
            try:
                resp = http_get_with_retry(
                    self._http,
                    GNEWS_API_URL,
                    params={
                        "q": term,
                        "lang": "en",
                        "country": "in",
                        "max": ARTICLES_PER_REQUEST,
                        "token": self._api_key,
                        "sortby": "publishedAt",
                    },
                )
                data = resp.json()
                articles = data.get("articles", [])

                for art in articles:
                    all_articles.append(
                        {
                            "url": art.get("url", ""),
                            "title": art.get("title", ""),
                            "published_at": self._parse_iso(art.get("publishedAt")),
                            "raw_json": art,
                        }
                    )

                logger.debug("[gnews] '%s' → %d articles", term, len(articles))
                self._throttle()

            except Exception as exc:
                logger.warning("[gnews] Error fetching term '%s': %s", term, exc)
                continue

        logger.info("[gnews] Total articles fetched: %d", len(all_articles))
        return all_articles
