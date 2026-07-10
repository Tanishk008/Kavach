"""Contracts for the scam hotspot map (A.5) and pattern dashboard (B.6)."""
from pydantic import BaseModel


class HotspotZone(BaseModel):
    region_city: str
    risk_level: str  # green | yellow | orange | red
    report_count: int
    top_scam_types: list[str]


class HotspotResponse(BaseModel):
    window: str  # week | month
    zones: list[HotspotZone]


class TrendPoint(BaseModel):
    scam_type: str
    count: int
    is_spiking: bool


class DashboardResponse(BaseModel):
    window: str
    trending: list[TrendPoint]
