"""Number intelligence (A.2) and reverse fraud search (B.1).

Deterministic, layered precedence — the same input always produces the same
output (no randomness anywhere in this module):

  1. Verified registry (B.4)        — explicit whitelist entry, highest trust
  2. TRAI 1600/1601 series match    — structurally verified service number
  3. Community reports              — crowdsourced negative signal
  4. Invalid number shape           — malformed/spoofed-looking number
  5. TRAI 140 series                — promotional/telemarketing (not fraud,
                                       but a mismatch if impersonating a bank)
  6. High cross-border-fraud-risk country of origin
  7. Unknown / neutral              — no signal either way

Operator (Airtel/Jio/Vi/…) is intentionally never asserted: Mobile Number
Portability (2011 onward) decouples the number prefix from the number's
actual current operator, so guessing it would be presenting a guess as fact.
We instead surface the *original allocation circle* with an explicit MNP
caveat — see app/core/number_meta.py.
"""
from __future__ import annotations

from collections import Counter

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.number_meta import (
    CATEGORY_LABELS,
    MNP_CAVEAT,
    classify_number_shape,
)
from app.models import CommunityReport, VerifiedNumber
from app.schemas.common import NumberVerdict
from app.schemas.numbers import (
    CategoryBreakdown,
    NumberCheckResponse,
    PayCheckResponse,
)

_REPORT_SCAM_THRESHOLD = 3  # confirmed scam reports at/above this → reported_scam
_TIPS = [
    "Never share OTP, UPI PIN, or bank details with a caller.",
    "Real agencies never demand payment to avoid arrest.",
    "If pressured, hang up and call the official number yourself.",
]


def _lookup_reports(db: Session, identifier: str) -> tuple[int, list[str], list[CategoryBreakdown]]:
    rows = db.scalars(
        select(CommunityReport).where(CommunityReport.identifier == identifier)
    ).all()
    categories = [r.category for r in rows]
    counts = Counter(categories)
    total = len(rows)
    breakdown = [
        CategoryBreakdown(
            category=cat,
            label=CATEGORY_LABELS.get(cat, cat.replace("_", " ").title()),
            count=n,
            pct=round(100 * n / total) if total else 0,
        )
        for cat, n in counts.most_common()
    ]
    top = [c for c, _ in counts.most_common(3)]
    return total, top, breakdown


def _report_risk_score(count: int, breakdown: list[CategoryBreakdown]) -> int:
    """Deterministic 0-100 score from report volume + severity mix."""
    severe = {"digital_arrest", "kyc_fraud", "bank_impersonation", "sextortion",
              "otp_theft", "investment_fraud", "loan_fraud"}
    severe_pct = sum(b.pct for b in breakdown if b.category in severe)
    base = min(70, count * 8)
    return min(99, base + round(severe_pct * 0.3))


def check_number(db: Session, raw_number: str) -> NumberCheckResponse:
    shape = classify_number_shape(raw_number)
    normalized = shape.normalized
    # Registry / report lookups key off the digits-only national significant
    # number when Indian, else the full normalized digit string.
    lookup_key = shape.national_number if shape.is_india else shape.normalized

    common_fields = dict(
        number=raw_number,
        number_type=shape.number_type,
        is_valid_shape=shape.is_valid_shape,
        country=shape.country.name if shape.country else None,
    )
    if shape.circle:
        common_fields["circle"] = shape.circle
        common_fields["circle_note"] = MNP_CAVEAT
    if shape.special_series:
        common_fields["special_series"] = shape.special_series.key

    # ── 1. Verified registry (whitelist) ────────────────────────────────────
    verified = db.scalar(
        select(VerifiedNumber).where(VerifiedNumber.phone_number == lookup_key)
    ) or db.scalar(
        select(VerifiedNumber).where(VerifiedNumber.phone_number == normalized)
    )
    if verified:
        return NumberCheckResponse(
            **common_fields,
            verdict=NumberVerdict.verified,
            institution=verified.institution,
            is_verified_service=True,
            risk_score=0,
            explanation=f"Verified official number: {verified.institution}.",
        )

    # ── 2. TRAI 1600/1601 series — structurally verified service number ────
    if shape.special_series and shape.special_series.key.startswith("verified"):
        return NumberCheckResponse(
            **common_fields,
            verdict=NumberVerdict.verified,
            institution=None,
            is_verified_service=True,
            risk_score=2,
            explanation=shape.special_series.description,
            tips=[
                "Genuine BFSI/government service calls now come only from the "
                "1600/1601 series — a bank call from any other number is a red flag.",
            ],
        )

    # ── 3. Community reports (blacklist) ────────────────────────────────────
    count, top_categories, breakdown = _lookup_reports(db, lookup_key)
    if count >= _REPORT_SCAM_THRESHOLD:
        scam_cats = [c for c in top_categories if c != "spam"]
        score = _report_risk_score(count, breakdown)
        if scam_cats:
            return NumberCheckResponse(
                **common_fields,
                verdict=NumberVerdict.reported_scam,
                report_count=count, top_categories=top_categories,
                category_breakdown=breakdown,
                risk_score=score,
                explanation=(
                    f"Reported {count} time(s) by the Kavach community, mainly for "
                    f"{', '.join(CATEGORY_LABELS.get(c, c) for c in scam_cats)}."
                ),
                tips=_TIPS,
            )
        return NumberCheckResponse(
            **common_fields,
            verdict=NumberVerdict.unwanted_not_confirmed,
            report_count=count, top_categories=top_categories,
            category_breakdown=breakdown,
            risk_score=min(55, score),
            explanation=f"Reported {count} time(s) as unwanted/spam, not confirmed fraud.",
        )
    if count > 0:
        # Below the confirmation threshold but not zero — still surface it.
        score = _report_risk_score(count, breakdown)
        return NumberCheckResponse(
            **common_fields,
            verdict=NumberVerdict.unwanted_not_confirmed,
            report_count=count, top_categories=top_categories,
            category_breakdown=breakdown,
            risk_score=score,
            explanation=(
                f"{count} community report(s) filed against this number — not yet "
                f"enough to confirm a pattern, but worth caution."
            ),
            tips=_TIPS,
        )

    # ── 4. Invalid / malformed shape ────────────────────────────────────────
    if not shape.is_valid_shape:
        return NumberCheckResponse(
            **common_fields,
            verdict=NumberVerdict.high_risk_pattern,
            report_count=0,
            risk_score=68,
            explanation=(
                "This number does not match a valid phone number format for its "
                "country/series. Malformed or irregular numbers are frequently used "
                "in spoofed caller-ID fraud."
            ),
            tips=_TIPS,
        )

    # ── 5. TRAI 140 series — promotional/telemarketing ──────────────────────
    if shape.number_type == "promotional":
        return NumberCheckResponse(
            **common_fields,
            verdict=NumberVerdict.unwanted_not_confirmed,
            report_count=0,
            risk_score=30,
            explanation=(
                "140-series numbers are reserved by TRAI for promotional/telemarketing "
                "calls only. If this caller claimed to be your bank, a government office, "
                "or law enforcement, that is a mismatch — regulated transactional calls "
                "must use the 1600/1601 series, not 140."
            ),
            tips=[
                "Register on the National Do Not Disturb (DND) list at trai.gov.in.",
                "A 140-series caller claiming to be a bank/government office is impersonating — hang up.",
            ],
        )

    # ── 6. High cross-border-fraud-risk country of origin ───────────────────
    if not shape.is_india and shape.country and shape.country.cross_border_fraud_risk == "high":
        return NumberCheckResponse(
            **common_fields,
            verdict=NumberVerdict.high_risk_pattern,
            report_count=0,
            risk_score=72,
            explanation=(
                f"This number originates from {shape.country.name} (+{shape.dial_code}). "
                "Numbers from this origin are frequently used in cross-border fraud "
                "campaigns impersonating Indian banks, government agencies, and courier "
                "services — even though this specific number has no reports yet."
            ),
            tips=[
                "Never share Aadhaar, PAN, OTP, or bank details on an unsolicited international call.",
                "Genuine Indian government agencies and banks do not call from international numbers.",
                "Hang up and verify independently; report to cybercrime.gov.in or call 1930.",
            ],
        )

    # ── 7. Unknown / neutral — no signal either way ─────────────────────────
    explanation = "No information found for this number — proceed with normal caution."
    if shape.is_india and shape.circle:
        explanation = (
            f"No fraud reports found for this number. Its series was originally "
            f"allocated in the {shape.circle} circle. {MNP_CAVEAT}"
        )
    elif not shape.is_india and shape.country:
        explanation = f"No fraud reports found for this {shape.country.name} number."

    return NumberCheckResponse(
        **common_fields,
        verdict=NumberVerdict.unknown_neutral,
        report_count=0,
        risk_score=8,
        explanation=explanation,
        tips=[
            "Always verify the caller's identity — even unreported numbers can be misused.",
            "Never share OTPs, PINs, or passwords over any call.",
        ],
    )


def reverse_fraud_search(db: Session, identifier: str) -> PayCheckResponse:
    """B.1 — check a UPI id / account / phone before paying."""
    count, _, _ = _lookup_reports(db, identifier)
    if count > 0:
        return PayCheckResponse(
            identifier=identifier, flagged=True, report_count=count,
            # TODO: cross-check the fraud graph for cluster membership + victim count
            explanation=f"Flagged — linked to {count} victim report(s). Do not pay; verify first.",
        )
    return PayCheckResponse(
        identifier=identifier, flagged=False,
        explanation="No red flags found — but always verify independently before paying.",
    )


def add_report(db: Session, identifier: str, identifier_type: str, category: str,
               user_id=None, note: str | None = None) -> tuple[CommunityReport, int]:
    report = CommunityReport(
        identifier=identifier, identifier_type=identifier_type,
        category=category, reported_by=user_id, note=note,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    total = db.scalar(
        select(func.count()).select_from(CommunityReport).where(
            CommunityReport.identifier == identifier
        )
    )
    return report, int(total or 0)
