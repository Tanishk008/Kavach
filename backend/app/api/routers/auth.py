"""Phone + OTP auth."""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import EmergencyContact, OtpCode, User
from app.schemas.auth import (
    OnboardingRequest,
    OnboardingResponse,
    SendOtpRequest,
    SendOtpResponse,
    VerifyOtpRequest,
    VerifyOtpResponse,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

DEMO_OTP = "123456"


def _derive_risk_profile(digital_comfort: str, age_group: str) -> str:
    if digital_comfort == "beginner" and age_group == "60_plus":
        return "senior_conservative"
    if digital_comfort == "very_comfortable" and age_group in ("under_30", "30_60"):
        return "advanced"
    return "standard"


@router.post("/send-otp", response_model=SendOtpResponse)
def send_otp(req: SendOtpRequest, db: Session = Depends(get_db)) -> SendOtpResponse:
    otp = OtpCode(
        phone_number=req.phone_number,
        code=DEMO_OTP,
        expires_at=datetime.utcnow() + timedelta(minutes=10),
    )
    db.add(otp)
    db.commit()
    return SendOtpResponse(phone_number=req.phone_number)


@router.post("/verify-otp", response_model=VerifyOtpResponse)
def verify_otp(req: VerifyOtpRequest, db: Session = Depends(get_db)) -> VerifyOtpResponse:
    otp = db.scalar(
        select(OtpCode)
        .where(OtpCode.phone_number == req.phone_number, OtpCode.consumed.is_(False))
        .order_by(OtpCode.created_at.desc())
    )
    if not otp or otp.code != req.code:
        raise HTTPException(status_code=400, detail="Invalid OTP. Hint: use 1234")
    if otp.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")

    otp.consumed = True

    user = db.scalar(select(User).where(User.phone_number == req.phone_number))
    if user is None:
        user = User(phone_number=req.phone_number, status="onboarding_incomplete")
        db.add(user)
    db.commit()
    db.refresh(user)

    return VerifyOtpResponse(
        user_id=str(user.id),
        session_token=f"demo-session-{user.id}",
        onboarding_complete=user.status == "active",
    )


@router.post("/onboarding", response_model=OnboardingResponse)
def complete_onboarding(req: OnboardingRequest, db: Session = Depends(get_db)) -> OnboardingResponse:
    user = db.get(User, req.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    user.digital_comfort = req.digital_comfort
    user.age_group = req.age_group
    user.preferred_language = req.preferred_language
    user.risk_profile = _derive_risk_profile(req.digital_comfort, req.age_group)
    user.status = "active"

    if req.emergency_contact_name and req.emergency_contact_phone:
        db.add(EmergencyContact(
            user_id=user.id,
            name=req.emergency_contact_name,
            phone_number=req.emergency_contact_phone,
        ))
    db.commit()
    db.refresh(user)
    return OnboardingResponse(user_id=str(user.id), risk_profile=user.risk_profile, status=user.status)

