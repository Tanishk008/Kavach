"""Evidence & reporting layer (B.8) — tamper-evident case files.

Compiles a structured payload, computes a SHA-256 hash over its canonical form
(so any later alteration is detectable), and pre-fills an NCRP complaint draft.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any


def compute_hash(payload: dict[str, Any]) -> str:
    """SHA-256 over a canonical (sorted-key) JSON encoding of the payload."""
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def build_ncrp_draft(payload: dict[str, Any]) -> dict[str, Any]:
    """Pre-fill the fields an NCRP / 1930 complaint needs, ready for user review."""
    return {
        "category": payload.get("scam_type") or "cyber_fraud",
        "description": payload.get("content_excerpt") or payload.get("summary", ""),
        "risk_verdict": payload.get("tier"),
        "evidence_hash": payload.get("sha256_hash"),
        "occurred_at": payload.get("created_at"),
        "helpline": "1930",
        "portal": "https://cybercrime.gov.in",
    }
