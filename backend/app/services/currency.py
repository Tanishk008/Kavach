"""Counterfeit currency detection (A.4).

STUB: returns deterministic mock output behind the real contract. Replace
`analyze_note()` internals with the two-stage CNN pipeline described in the spec
(Stage 1 denomination classifier → Stage 2 denomination-specific authenticity model).
"""
from __future__ import annotations

from app.schemas.currency import CurrencyCheckResponse

_FEATURES = [
    "security thread continuity",
    "microprint sharpness",
    "watermark placement",
    "serial number font consistency",
]


def analyze_note(image_bytes: bytes, filename: str = "") -> CurrencyCheckResponse:
    """TODO: real CV inference.

    1. Pre-check: is this even a currency note? If not → friendly rejection.
    2. Stage 1 CNN: denomination (10/20/50/100/200/500/2000).
    3. Stage 2 CNN (denomination-specific): authenticity + which features triggered.
    """
    if not image_bytes:
        return CurrencyCheckResponse(
            denomination=None, authenticity="uncertain", confidence=0.0,
            features_checked=[],
            message="This doesn't look like a currency note — please try again.",
        )

    # Deterministic mock so the UI flow is demoable without the model.
    return CurrencyCheckResponse(
        denomination="500",
        authenticity="uncertain",
        confidence=0.5,
        features_checked=_FEATURES,
        message=("Currency model not yet wired — this is a placeholder result. "
                 "Retake the photo in good lighting for a real check."),
    )
