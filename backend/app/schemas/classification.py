"""Contracts for the shared classifier core (A.3)."""
from pydantic import BaseModel, Field

from app.schemas.common import Channel, VerdictTier


class PlaybookStep(BaseModel):
    order: int
    text: str


class Playbook(BaseModel):
    id: str
    title: str
    steps: list[PlaybookStep]


class ClassifyRequest(BaseModel):
    """A message/screenshot-text/voice-transcript to classify.

    All three front doors (app, WhatsApp, IVR) post to the same endpoint.
    """

    text: str = Field(..., min_length=1, description="Message text or transcript to classify")
    channel: Channel = Channel.app
    input_type: str = Field("text", description="text | image | voice")
    user_id: str | None = None
    # Optional coarse location (city/PIN only, consent-gated) → hotspot map
    region_city: str | None = None
    region_pin: str | None = None
    # Present only for the voice sub-path (A.3 / B.2)
    voice_deepfake_likelihood: str | None = Field(
        None, description="low | medium | high — from the deepfake model, if a voice note"
    )


class VoiceSignal(BaseModel):
    deepfake_likelihood: str  # low | medium | high
    note: str


class UrlFinding(BaseModel):
    url: str
    risk_score: int
    signals: list[str]


class Extracted(BaseModel):
    urls: list[UrlFinding] = []
    keywords: list[str] = []
    phone_numbers: list[str] = []


class ClassifyResponse(BaseModel):
    tier: VerdictTier
    confidence: float
    scam_type: str | None
    reasons: list[str]
    playbook: Playbook | None
    voice_signal: VoiceSignal | None = None
    event_id: str | None = None

    # ── Richer, deterministic enrichment (added) ────────────────────────────
    risk_score: int = 0                 # 0-100, deterministic
    extracted: Extracted = Extracted()
