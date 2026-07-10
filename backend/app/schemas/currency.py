"""Contracts for counterfeit currency detection (A.4)."""
from pydantic import BaseModel


class CurrencyCheckResponse(BaseModel):
    denomination: str | None
    authenticity: str  # real | fake | uncertain
    confidence: float
    features_checked: list[str]
    message: str
