"""Gemini-powered structured extractor for cybercrime articles.

Uses google-generativeai (Gemini 1.5 Flash) to extract:
    - Title, Summary
    - Crime Type, Subcategory
    - Incident Date, State, District, City
    - Money Lost (INR), Victim Count, Suspect Count
    - Confidence score

Strict prompt: "Return null for unknown fields. Do NOT hallucinate."
Falls back to heuristic extraction when Gemini is unavailable.
"""
from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.intelligence import ProcessedArticle, RawArticle

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Crime type taxonomy (used by both Gemini prompt and heuristic fallback)
# ---------------------------------------------------------------------------
CRIME_TYPES = [
    "UPI Scam",
    "Digital Arrest",
    "OTP Fraud",
    "Investment Scam",
    "Loan App Fraud",
    "Phishing",
    "Vishing",
    "WhatsApp Scam",
    "SIM Swap",
    "Crypto Scam",
    "Online Banking Fraud",
    "Credit Card Fraud",
    "Cyber Extortion",
    "Ransomware",
    "Data Breach",
    "Social Engineering",
    "Sextortion",
    "Job Fraud",
    "Lottery Fraud",
    "Other Cybercrime",
]

EXTRACTION_PROMPT_TEMPLATE = """You are a cybercrime intelligence analyst. Extract structured information from the following news article about a cybercrime incident in India.

Return ONLY a valid JSON object with exactly these fields. Use null for any field you cannot determine from the text — do NOT guess or hallucinate.

Required JSON structure:
{{
  "title": "string or null",
  "summary": "1-2 sentence summary of the incident, or null",
  "crime_type": "one of: {crime_types}, or null",
  "subcategory": "more specific sub-type if identifiable, or null",
  "incident_date": "ISO 8601 date string (YYYY-MM-DD) if mentioned, or null",
  "state": "Indian state name if mentioned, or null",
  "district": "district name if mentioned, or null",
  "city": "city name if mentioned, or null",
  "money_lost_inr": "numeric amount in INR if mentioned (convert lakhs/crores), or null",
  "victim_count": "number of victims if mentioned, or null",
  "suspect_count": "number of suspects/arrested if mentioned, or null",
  "confidence": "your confidence in the extraction quality, between 0.0 and 1.0"
}}

Rules:
- Return ONLY the JSON object, no markdown, no explanation
- All string values must be in English
- money_lost_inr must be a plain number (e.g. 500000 for 5 lakh)
- Do NOT invent location names not present in the article
- If the article is not about a cybercrime incident, return all fields as null with confidence 0.1

Article:
Title: {title}
Content: {content}
"""


class GeminiExtractor:
    """Extracts structured crime data from raw articles using Gemini Flash."""

    BATCH_SIZE = 10
    REQUEST_DELAY = 0.5  # seconds between Gemini calls

    def __init__(self, db: Session) -> None:
        self.db = db
        self._settings = get_settings()
        self._client = None
        self._init_gemini()

    def _init_gemini(self) -> None:
        """Initialize Gemini client if API key is configured."""
        api_key = self._settings.gemini_api_key
        if not api_key:
            logger.warning("[extractor] GEMINI_API_KEY not set — using heuristic fallback.")
            return
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            self._client = genai.GenerativeModel("gemini-2.5-flash")
            logger.info("[extractor] Gemini 2.5 Flash client initialized.")
        except Exception as exc:
            logger.error("[extractor] Failed to initialize Gemini: %s", exc)

    def extract_pending(self, limit: int = 50) -> tuple[int, int]:
        """Process unprocessed raw articles.

        Returns:
            (processed_count, error_count)
        """
        pending = (
            self.db.query(RawArticle)
            .filter(RawArticle.is_processed == False)  # noqa: E712
            .limit(limit)
            .all()
        )

        if not pending:
            logger.info("[extractor] No pending articles to process.")
            return 0, 0

        processed = errors = 0
        for raw in pending:
            try:
                extracted = self._extract_one(raw)
                article = ProcessedArticle(
                    raw_article_id=raw.id,
                    title=extracted.get("title") or raw.title,
                    summary=extracted.get("summary"),
                    crime_type=extracted.get("crime_type"),
                    subcategory=extracted.get("subcategory"),
                    incident_date=self._parse_date(extracted.get("incident_date")),
                    state=extracted.get("state"),
                    district=extracted.get("district"),
                    city=extracted.get("city"),
                    money_lost_inr=self._safe_float(extracted.get("money_lost_inr")),
                    victim_count=self._safe_int(extracted.get("victim_count")),
                    suspect_count=self._safe_int(extracted.get("suspect_count")),
                    source_name=raw.source_name,
                    source_url=raw.url,
                    confidence=self._safe_float(extracted.get("confidence")),
                )
                self.db.add(article)
                raw.is_processed = True
                processed += 1

            except Exception as exc:
                logger.warning("[extractor] Failed on article %s: %s", raw.id, exc)
                # Still mark as processed with error to avoid infinite retry
                article = ProcessedArticle(
                    raw_article_id=raw.id,
                    title=raw.title,
                    source_name=raw.source_name,
                    source_url=raw.url,
                    extraction_error=str(exc),
                )
                self.db.add(article)
                raw.is_processed = True
                errors += 1

            if (processed + errors) % self.BATCH_SIZE == 0:
                self.db.commit()

        self.db.commit()
        logger.info("[extractor] Processed: %d, Errors: %d", processed, errors)
        return processed, errors

    def _extract_one(self, raw: RawArticle) -> dict[str, Any]:
        """Extract structured data from one raw article."""
        raw_data = raw.raw_json or {}
        content = (
            raw_data.get("content", "")
            or raw_data.get("description", "")
            or raw_data.get("summary", "")
            or ""
        )
        title = raw.title or ""

        if self._client:
            return self._gemini_extract(title, content)
        return self._heuristic_extract(title, content)

    def _gemini_extract(self, title: str, content: str) -> dict[str, Any]:
        """Call Gemini API for structured extraction."""
        prompt = EXTRACTION_PROMPT_TEMPLATE.format(
            crime_types=", ".join(CRIME_TYPES),
            title=title[:500],
            content=content[:3000],
        )
        try:
            response = self._client.generate_content(prompt)
            text = response.text.strip()

            # Strip markdown code fences if present
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)

            data = json.loads(text)
            time.sleep(self.REQUEST_DELAY)
            return data

        except json.JSONDecodeError as exc:
            logger.warning("[extractor] Gemini returned invalid JSON: %s", exc)
            return self._heuristic_extract(title, content)
        except Exception as exc:
            logger.warning("[extractor] Gemini API error: %s", exc)
            return self._heuristic_extract(title, content)

    def _heuristic_extract(self, title: str, content: str) -> dict[str, Any]:
        """Rule-based fallback extraction when Gemini is unavailable."""
        combined = (title + " " + content).lower()

        crime_type = self._detect_crime_type(combined)
        state, city = self._detect_location(combined)
        money = self._detect_money(combined)

        return {
            "title": title or None,
            "summary": None,
            "crime_type": crime_type,
            "subcategory": None,
            "incident_date": None,
            "state": state,
            "district": None,
            "city": city,
            "money_lost_inr": money,
            "victim_count": None,
            "suspect_count": None,
            "confidence": 0.4,
        }

    @staticmethod
    def _detect_crime_type(text: str) -> str | None:
        patterns = [
            ("Digital Arrest", ["digital arrest"]),
            ("UPI Scam", ["upi scam", "upi fraud"]),
            ("OTP Fraud", ["otp fraud", "otp scam", "share otp"]),
            ("Investment Scam", ["investment fraud", "investment scam", "trading fraud", "stock tips"]),
            ("Loan App Fraud", ["loan app", "loan fraud", "instant loan"]),
            ("Phishing", ["phishing", "phish"]),
            ("Vishing", ["vishing", "voice call fraud"]),
            ("WhatsApp Scam", ["whatsapp scam", "whatsapp fraud"]),
            ("SIM Swap", ["sim swap", "sim cloning"]),
            ("Crypto Scam", ["crypto scam", "cryptocurrency fraud", "bitcoin scam"]),
            ("Online Banking Fraud", ["banking fraud", "bank fraud", "net banking"]),
            ("Credit Card Fraud", ["credit card fraud", "card skimming"]),
            ("Sextortion", ["sextortion", "nude video", "video leaked"]),
            ("Job Fraud", ["job fraud", "fake job", "work from home fraud"]),
            ("Ransomware", ["ransomware"]),
            ("Cyber Extortion", ["cyber extortion", "extortion"]),
        ]
        for crime_type, keywords in patterns:
            if any(kw in text for kw in keywords):
                return crime_type
        if "cyber" in text or "fraud" in text or "scam" in text:
            return "Other Cybercrime"
        return None

    @staticmethod
    def _detect_location(text: str) -> tuple[str | None, str | None]:
        """Detect Indian state and city from text using a curated list."""
        states = {
            "delhi": "Delhi", "mumbai": "Maharashtra", "bangalore": "Karnataka",
            "bengaluru": "Karnataka", "chennai": "Tamil Nadu", "hyderabad": "Telangana",
            "kolkata": "West Bengal", "pune": "Maharashtra", "ahmedabad": "Gujarat",
            "jaipur": "Rajasthan", "lucknow": "Uttar Pradesh", "kanpur": "Uttar Pradesh",
            "noida": "Uttar Pradesh", "gurugram": "Haryana", "gurgaon": "Haryana",
            "chandigarh": "Punjab", "bhopal": "Madhya Pradesh", "indore": "Madhya Pradesh",
            "nagpur": "Maharashtra", "surat": "Gujarat", "patna": "Bihar",
            "ranchi": "Jharkhand", "bhubaneswar": "Odisha", "guwahati": "Assam",
            "thiruvananthapuram": "Kerala", "kochi": "Kerala", "coimbatore": "Tamil Nadu",
            "visakhapatnam": "Andhra Pradesh", "vijayawada": "Andhra Pradesh",
        }
        state_names = {
            "maharashtra", "karnataka", "tamil nadu", "telangana", "west bengal",
            "gujarat", "rajasthan", "uttar pradesh", "haryana", "madhya pradesh",
            "bihar", "jharkhand", "odisha", "assam", "kerala", "andhra pradesh",
            "delhi", "goa", "punjab", "himachal pradesh", "uttarakhand",
        }

        detected_city = detected_state = None
        for city, state in states.items():
            if city in text:
                detected_city = city.title()
                detected_state = state
                break

        if not detected_state:
            for state in state_names:
                if state in text:
                    detected_state = state.title()
                    break

        return detected_state, detected_city

    @staticmethod
    def _detect_money(text: str) -> float | None:
        """Extract money amount in INR from text."""
        patterns = [
            (r"rs\.?\s*([\d,]+(?:\.\d+)?)\s*crore", 1e7),
            (r"₹\s*([\d,]+(?:\.\d+)?)\s*crore", 1e7),
            (r"([\d,]+(?:\.\d+)?)\s*crore\s*(?:rupee|rs|₹)?", 1e7),
            (r"rs\.?\s*([\d,]+(?:\.\d+)?)\s*lakh", 1e5),
            (r"₹\s*([\d,]+(?:\.\d+)?)\s*lakh", 1e5),
            (r"([\d,]+(?:\.\d+)?)\s*lakh\s*(?:rupee|rs|₹)?", 1e5),
            (r"rs\.?\s*([\d,]+(?:\.\d+)?)", 1),
            (r"₹\s*([\d,]+(?:\.\d+)?)", 1),
        ]
        for pattern, multiplier in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    amount_str = match.group(1).replace(",", "")
                    return float(amount_str) * multiplier
                except ValueError:
                    continue
        return None

    @staticmethod
    def _parse_date(date_str: str | None) -> datetime | None:
        if not date_str:
            return None
        try:
            dt = datetime.fromisoformat(date_str)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            return None

    @staticmethod
    def _safe_float(val: Any) -> float | None:
        try:
            return float(val) if val is not None else None
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _safe_int(val: Any) -> int | None:
        try:
            return int(val) if val is not None else None
        except (TypeError, ValueError):
            return None
