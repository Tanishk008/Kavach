"""SMS delivery helpers for auth OTPs."""
from __future__ import annotations

import base64

import httpx

from app.config import Settings


class SmsDeliveryError(RuntimeError):
    """Raised when the configured SMS gateway cannot send a message."""


def send_otp_sms(settings: Settings, phone_number: str, code: str) -> None:
    message = f"Your Kavach verification code is {code}. It expires in 5 minutes."
    provider = settings.sms_provider.lower().strip()
    if provider == "msg91":
        _send_msg91(settings, phone_number, code)
        return
    if provider == "twilio":
        _send_twilio(settings, phone_number, message)
        return
    raise SmsDeliveryError("SMS gateway is not configured")


def _send_msg91(settings: Settings, phone_number: str, code: str) -> None:
    if not settings.msg91_auth_key or not settings.msg91_template_id:
        raise SmsDeliveryError("MSG91 credentials are missing")

    params: dict[str, object] = {
        "template_id": settings.msg91_template_id,
        "mobile": f"91{phone_number[-10:]}",
        "authkey": settings.msg91_auth_key,
        "otp": code,
    }
    if settings.msg91_otp_expiry_minutes:
        params["otp_expiry"] = settings.msg91_otp_expiry_minutes

    with httpx.Client(timeout=10) as client:
        res = client.post("https://control.msg91.com/api/v5/otp", params=params)
    if res.status_code >= 400:
        raise SmsDeliveryError(f"MSG91 failed with status {res.status_code}: {res.text[:180]}")


def _send_twilio(settings: Settings, phone_number: str, message: str) -> None:
    if not settings.twilio_account_sid or not settings.twilio_auth_token or not settings.twilio_from_number:
        raise SmsDeliveryError("Twilio credentials are missing")

    token = base64.b64encode(
        f"{settings.twilio_account_sid}:{settings.twilio_auth_token}".encode("utf-8")
    ).decode("ascii")
    to_number = phone_number if phone_number.startswith("+") else f"+91{phone_number[-10:]}"
    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json"
    with httpx.Client(timeout=10) as client:
        res = client.post(
            url,
            data={"From": settings.twilio_from_number, "To": to_number, "Body": message},
            headers={"Authorization": f"Basic {token}"},
        )
    if res.status_code >= 400:
        raise SmsDeliveryError(f"Twilio failed with status {res.status_code}")
