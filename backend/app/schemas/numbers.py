"""Contracts for number look-up (A.2) and reverse fraud search (B.1)."""
from pydantic import BaseModel, Field

from app.schemas.common import NumberVerdict


class NumberCheckRequest(BaseModel):
    number: str = Field(..., description="Phone number to check")


class CategoryBreakdown(BaseModel):
    category: str
    label: str
    count: int
    pct: int


class NumberCheckResponse(BaseModel):
    number: str
    verdict: NumberVerdict
    institution: str | None = None  # set when verdict == verified
    report_count: int = 0
    top_categories: list[str] = []
    explanation: str
    tips: list[str] = []

    # ── Factual, deterministic enrichment (added) ───────────────────────────
    number_type: str = "unknown"          # mobile | service_1600 | promotional | toll_free | unknown
    is_valid_shape: bool = True
    country: str | None = None            # e.g. "India", "Pakistan"
    circle: str | None = None             # original allocation circle (India mobile only)
    circle_note: str | None = None        # MNP caveat, only set alongside `circle`
    is_verified_service: bool = False     # true for verified registry OR 1600/1601 series match
    special_series: str | None = None     # e.g. "promotional_140", "verified_1600"
    risk_score: int = 0                   # 0-100, deterministic
    category_breakdown: list[CategoryBreakdown] = []


class PayCheckRequest(BaseModel):
    identifier: str = Field(..., description="UPI id, account number, or phone number")


class PayCheckResponse(BaseModel):
    identifier: str
    flagged: bool
    report_count: int = 0
    cluster_ref: str | None = None
    cluster_victim_count: int | None = None
    explanation: str


class ReportRequest(BaseModel):
    identifier: str
    identifier_type: str = Field("phone", description="phone | upi | account")
    category: str = Field(..., description="digital_arrest | loan_fraud | investment | spam | other")
    user_id: str | None = None
    note: str | None = None


class ReportResponse(BaseModel):
    id: str
    identifier: str
    total_reports: int
