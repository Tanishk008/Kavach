"""NewsAPI.org collector.

NewsAPI docs: https://newsapi.org/docs
Requires an API key (NEWS_API_KEY env var).
Free plan is limited to developer use; production requires a paid plan.

This collector gracefully skips if the key is absent.
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

NEWS_API_URL = "https://newsapi.org/v2/everything"
MAX_REQUESTS_PER_RUN = 8
PAGE_SIZE = 20


class NewsAPICollector(BaseCollector):
    """Fetches cybercrime articles from NewsAPI.org."""

    source_name = "newsapi"

    def __init__(self, db, run_id=None) -> None:
        super().__init__(db, run_id)
        self._api_key = get_settings().news_api_key

    def _fetch_articles(self) -> list[dict[str, Any]]:
        if not self._api_key:
            logger.info("[newsapi] NEWS_API_KEY not configured — skipping source.")
            return []

        all_articles: list[dict[str, Any]] = []
        terms_to_use = CYBERCRIME_SEARCH_TERMS[:MAX_REQUESTS_PER_RUN]

        for term in terms_to_use:
            try:
                resp = http_get_with_retry(
                    self._http,
                    NEWS_API_URL,
                    params={
                        "q": term,
                        "language": "en",
                        "sortBy": "publishedAt",
                        "pageSize": PAGE_SIZE,
                        "apiKey": self._api_key,
                    },
                )
                data = resp.json()

                if data.get("status") != "ok":
                    logger.warning(
                        "[newsapi] API error for '%s': %s",
                        term, data.get("message", "unknown error"),
                    )
                    continue

                for art in data.get("articles", []):
                    url = art.get("url", "")
                    if not url or "[Removed]" in url:
                        continue
                    all_articles.append(
                        {
                            "url": url,
                            "title": art.get("title", ""),
                            "published_at": self._parse_iso(art.get("publishedAt")),
                            "raw_json": art,
                        }
                    )

                self._throttle()

            except Exception as exc:
                logger.warning("[newsapi] Error for term '%s': %s", term, exc)
                continue

        logger.info("[newsapi] Total articles fetched: %d", len(all_articles))
        return all_articles
