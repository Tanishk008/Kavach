"""Shared enums and value types used across schemas."""
from enum import Enum


class VerdictTier(str, Enum):
    safe = "safe"
    caution = "caution"
    high_risk = "high_risk"


class NumberVerdict(str, Enum):
    verified = "verified"
    reported_scam = "reported_scam"
    high_risk_pattern = "high_risk_pattern"
    unwanted_not_confirmed = "unwanted_not_confirmed"
    unknown_neutral = "unknown_neutral"


class Channel(str, Enum):
    app = "app"
    whatsapp = "whatsapp"
    ivr = "ivr"
