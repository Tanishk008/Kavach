"""Contracts for phone + OTP auth (A.1) and onboarding (A.1.1)."""
from pydantic import BaseModel, Field


class SendOtpRequest(BaseModel):
    phone_number: str = Field(..., min_length=10, max_length=15)


class SendOtpResponse(BaseModel):
    phone_number: str
    resend_after_seconds: int = 30


class VerifyOtpRequest(BaseModel):
    phone_number: str
    code: str = Field(..., min_length=4, max_length=6)


class VerifyOtpResponse(BaseModel):
    user_id: str
    session_token: str
    onboarding_complete: bool


class OnboardingRequest(BaseModel):
    user_id: str
    digital_comfort: str  # beginner | comfortable | very_comfortable
    age_group: str  # under_30 | 30_60 | 60_plus
    preferred_language: str = "en"
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None


class OnboardingResponse(BaseModel):
    user_id: str
    risk_profile: str
    status: str
