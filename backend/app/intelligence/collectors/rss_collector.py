"""RSS / Atom feed collector for government cyber advisory sources.

Sources:
    - CERT-In advisories      https://www.cert-in.org.in/RSS/rss.php
    - MHA / I4C Cyber News    https://www.mha.gov.in/RSS/mhanewsen.xml
    - PIB Press Releases      https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3
    - Cyber Dost Twitter RSS  (unavailable — skipped)

All feeds are public government information; no scraping, no ToS violation.
"""
from __future__ import annotations

import logging
from typing import Any

import feedparser

from app.intelligence.collectors.base_collector import BaseCollector

logger = logging.getLogger(__name__)

# Public government RSS feeds (no API key required)
RSS_FEEDS: list[dict[str, str]] = [
    {
        "name": "cert_in",
        "url": "https://www.cert-in.org.in/RSS/rss.php",
        "label": "CERT-In Advisories",
    },
    {
        "name": "mha_news",
        "url": "https://www.mha.gov.in/RSS/mhanewsen.xml",
        "label": "MHA News (Cyber)",
    },
    {
        "name": "pib_cyber",
        "url": "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3",
        "label": "PIB Cyber Press Releases",
    },
]

# Keywords that qualify an RSS entry as cyber-crime related
CYBER_KEYWORDS = {
    "cyber", "fraud", "scam", "phishing", "ransomware", "malware",
    "online crime", "digital arrest", "otp", "upi", "banking fraud",
    "investment fraud", "i4c", "cert", "advisory", "vulnerability",
    "data breach", "identity theft",
}


class RSSCollector(BaseCollector):
    """Fetches and filters government RSS/Atom advisory feeds."""

    source_name = "rss_govt"

    def _fetch_articles(self) -> list[dict[str, Any]]:
        all_articles: list[dict[str, Any]] = []

        for feed_cfg in RSS_FEEDS:
            feed_url = feed_cfg["url"]
            feed_name = feed_cfg["name"]

            try:
                feed = feedparser.parse(feed_url)
                if feed.bozo and not feed.entries:
                    logger.warning(
                        "[rss:%s] Feed parse error: %s", feed_name, feed.bozo_exception
                    )
                    continue

                entries_added = 0
                for entry in feed.entries:
                    title = entry.get("title", "")
                    summary = entry.get("summary", entry.get("description", ""))
                    link = entry.get("link", "")

                    if not link:
                        continue

                    # Filter: only include cyber-related entries
                    combined_text = (title + " " + summary).lower()
                    if not any(kw in combined_text for kw in CYBER_KEYWORDS):
                        continue

                    published_at = None
                    if hasattr(entry, "published_parsed") and entry.published_parsed:
                        import calendar
                        from datetime import datetime, timezone
                        published_at = datetime(
                            *entry.published_parsed[:6], tzinfo=timezone.utc
                        )

                    all_articles.append(
                        {
                            "url": link,
                            "title": title,
                            "published_at": published_at,
                            "raw_json": {
                                "feed_name": feed_name,
                                "feed_label": feed_cfg["label"],
                                "title": title,
                                "summary": summary,
                                "link": link,
                                "published": entry.get("published", ""),
                            },
                        }
                    )
                    entries_added += 1

                logger.info(
                    "[rss:%s] %d cyber-relevant entries from %s",
                    feed_name, entries_added, feed_cfg["label"],
                )
                self._throttle()

            except Exception as exc:
                logger.warning(
                    "[rss:%s] Failed to parse feed %s: %s", feed_name, feed_url, exc
                )
                continue

        logger.info("[rss] Total articles collected: %d", len(all_articles))
        return all_articles
