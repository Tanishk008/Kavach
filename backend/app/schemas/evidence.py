"""Contracts for evidence export / case files (B.8)."""
from pydantic import BaseModel


class GenerateCaseRequest(BaseModel):
    event_id: str | None = None
    user_id: str | None = None
    # Free-form content when not tied to a stored event
    content: dict | None = None


class CaseFileResponse(BaseModel):
    case_id: str
    sha256_hash: str
    cluster_ref: str | None = None
    payload: dict
    ncrp_draft: dict  # pre-filled complaint fields for review
