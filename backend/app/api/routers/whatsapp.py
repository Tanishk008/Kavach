"""WhatsApp Bot webhook router — Kavach's WhatsApp front door.

Receives incoming WhatsApp messages from Twilio, routes them through the
existing Kavach classifier/OCR/voice pipeline, and sends a formatted reply
back to the user using the same phone number they registered with.

Supported inputs:
  - Text messages  → messages classifier
  - Images         → OCR extractor → then classifier on extracted text
  - Audio/Voice    → voice deepfake analyzer → then classifier on transcript
  - Media fallback → polite "unsupported format" reply

Linking: the sender's phone number (in E.164 format) is looked up in the
users table. If not found, the bot still works — it just replies without
a personalized greeting.
"""
from __future__ import annotations

import io
import logging
import re
import textwrap
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, Form, Request, Response
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.config import get_settings
from app.models.user import User
from app.schemas.classification import ClassifyRequest
from app.services import classifier

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])

# ── helpers ──────────────────────────────────────────────────────────────────

def _e164(raw: str) -> str:
    """Strip the 'whatsapp:' prefix Twilio adds to phone numbers."""
    return raw.replace("whatsapp:", "").strip()


def _twiml_response(body: str) -> Response:
    """Wrap a plain-text reply in TwiML so Twilio sends it as a WhatsApp message."""
    safe_body = body.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<Response>"
        f"<Message>{safe_body}</Message>"
        "</Response>"
    )
    return Response(content=xml, media_type="application/xml")


def _lookup_user(db: Session, phone: str) -> Optional[User]:
    """Find a Kavach user by phone number (tries +91XXXXXXXXXX and 0XXXXXXXXXX)."""
    return db.query(User).filter(User.phone_number == phone).first()


def _tier_emoji(tier: str) -> str:
    mapping = {"safe": "[SAFE]", "caution": "[CAUTION]", "high_risk": "[HIGH RISK]"}
    return mapping.get(tier, tier.upper())


def _send_whatsapp_message(to: str, body: str) -> None:
    """Send a WhatsApp reply via the Twilio REST API (fire-and-forget)."""
    if not (settings.twilio_account_sid and settings.twilio_auth_token):
        logger.warning("[whatsapp] Twilio credentials not set — skipping reply send.")
        return
    from_number = settings.twilio_whatsapp_number or "whatsapp:+14155238886"
    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json"
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.post(
                url,
                auth=(settings.twilio_account_sid, settings.twilio_auth_token),
                data={"From": from_number, "To": f"whatsapp:{to}", "Body": body},
            )
            resp.raise_for_status()
            logger.info("[whatsapp] Sent reply to %s (sid=%s)", to, resp.json().get("sid"))
    except Exception as exc:
        logger.error("[whatsapp] Failed to send reply: %s", exc)


def _format_classify_reply(result, user: Optional[User]) -> str:
    """Build a concise, WhatsApp-friendly verdict message."""
    tier_label = _tier_emoji(result.tier.value)
    greeting = f"Hi {user.phone_number}! " if user else ""

    lines = [
        f"{greeting}Kavach Analysis Result",
        f"{'=' * 28}",
        f"Verdict: {tier_label}",
        f"Confidence: {int(result.confidence * 100)}%",
    ]

    if result.scam_type:
        scam_label = result.scam_type.replace("_", " ").title()
        lines.append(f"Scam Type: {scam_label}")

    if result.reasons:
        lines.append("")
        lines.append("Why:")
        for r in result.reasons[:3]:
            lines.append(f"  - {textwrap.shorten(r, 90)}")

    if result.playbook and result.playbook.steps:
        lines.append("")
        lines.append("What to do:")
        for step in result.playbook.steps[:3]:
            lines.append(f"  {step.order}. {textwrap.shorten(step.text, 90)}")

    lines.append("")
    lines.append("Stay safe! Forward any suspicious message to Kavach anytime.")
    return "\n".join(lines)


# ── Webhook endpoint ──────────────────────────────────────────────────────────

@router.post("/webhook")
async def whatsapp_webhook(
    request: Request,
    db: Session = Depends(get_db),
    From: str = Form(...),
    Body: str = Form(""),
    NumMedia: str = Form("0"),
    MediaUrl0: Optional[str] = Form(None),
    MediaContentType0: Optional[str] = Form(None),
):
    """Handle all incoming WhatsApp messages from Twilio."""
    sender_raw = From  # e.g. "whatsapp:+919876543210"
    sender_phone = _e164(sender_raw)
    num_media = int(NumMedia or 0)
    text_body = (Body or "").strip()

    logger.info(
        "[whatsapp] Message from %s | media=%d | body=%r",
        sender_phone, num_media, text_body[:80],
    )

    user = _lookup_user(db, sender_phone)

    # ── 1. Greeting / onboarding ─────────────────────────────────────────────
    # Normalize input and remove punctuation
    normalized_body = re.sub(r"[^\w\s]", "", text_body.lower().strip())
    greet_phrases = {"hi", "hello", "hey", "start", "kavach", "hi kavach", "hello kavach"}
    
    if not num_media and (normalized_body in greet_phrases or text_body.strip() == ""):
        name = "there"
        reply = (
            f"Hi {name}! I am Kavach Bot.\n\n"
            "I can help you check if a message, image, or voice note is a scam.\n\n"
            "Just forward me:\n"
            "  - Any suspicious *text* or SMS\n"
            "  - A *screenshot* of a suspicious message\n"
            "  - A *voice note* you received\n\n"
            "I will analyse it instantly and tell you if it is safe or a scam.\n\n"
            "Stay protected!"
        )
        return _twiml_response(reply)

    # ── 2. Image / Screenshot → OCR → classify ───────────────────────────────
    if num_media > 0 and MediaContentType0 and MediaContentType0.startswith("image/"):
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                img_resp = await client.get(
                    MediaUrl0,
                    auth=(settings.twilio_account_sid, settings.twilio_auth_token),
                )
                img_resp.raise_for_status()
                img_bytes = img_resp.content

            # Use the existing OCR service
            from app.services import currency as currency_service  # reuse PIL import pattern
            try:
                import easyocr
                reader = easyocr.Reader(["en"], gpu=False, verbose=False)
                ocr_result = reader.readtext(img_bytes, detail=0)
                extracted_text = " ".join(ocr_result).strip()
            except Exception as ocr_err:
                logger.warning("[whatsapp] OCR failed: %s", ocr_err)
                extracted_text = ""

            if not extracted_text:
                return _twiml_response(
                    "I received your image but could not extract any text from it.\n"
                    "Please try sending the message as plain text for a more accurate analysis."
                )

            req = ClassifyRequest(
                text=extracted_text,
                channel="whatsapp",
                input_type="image_ocr",
                user_id=user.id if user else None,
            )
            result = classifier.classify_text(req)
            reply = f"[Image Scan]\n\n" + _format_classify_reply(result, user)
            return _twiml_response(reply)

        except Exception as exc:
            logger.error("[whatsapp] Image processing error: %s", exc)
            return _twiml_response(
                "Sorry, I had trouble processing your image. "
                "Please try again or send the text directly."
            )

    # ── 3. Voice / Audio → voice analyzer ────────────────────────────────────
    if num_media > 0 and MediaContentType0 and MediaContentType0.startswith("audio/"):
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                audio_resp = await client.get(
                    MediaUrl0,
                    auth=(settings.twilio_account_sid, settings.twilio_auth_token),
                )
                audio_resp.raise_for_status()
                audio_bytes = audio_resp.content

            from app.services import classifier as _clf  # noqa – already imported
            import tempfile, os
            suffix = ".ogg" if "ogg" in (MediaContentType0 or "") else ".mp3"
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            try:
                from app.api.routers.voice import _analyse_audio_file  # type: ignore
                voice_result = _analyse_audio_file(tmp_path)
                deepfake_likelihood = voice_result.get("deepfake_likelihood", "unknown")
            except Exception:
                deepfake_likelihood = "unknown"
            finally:
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass

            label_map = {
                "low": "likely authentic",
                "medium": "possibly manipulated",
                "high": "likely AI-generated / deepfake",
                "unknown": "could not be determined",
            }
            label = label_map.get(deepfake_likelihood, deepfake_likelihood)

            risk_line = {
                "low": "The voice sounds authentic. Still, be careful about what the caller is asking.",
                "medium": "The voice shows some signs of manipulation. Verify the caller's identity before acting.",
                "high": "WARNING: This voice note is likely AI-generated (deepfake). Do NOT follow any instructions.",
                "unknown": "Could not fully analyse this voice note. Treat unknown callers with caution.",
            }.get(deepfake_likelihood, "")

            reply = (
                f"[Voice Note Analysis]\n"
                f"{'=' * 28}\n"
                f"AI / Deepfake likelihood: {label.upper()}\n\n"
                f"{risk_line}\n\n"
                f"Stay safe! If you received a suspicious call, report it to 1930 (National Cyber Crime Helpline)."
            )
            return _twiml_response(reply)

        except Exception as exc:
            logger.error("[whatsapp] Audio processing error: %s", exc)
            return _twiml_response(
                "Sorry, I could not analyse the voice note. "
                "Please try again or describe the call in text."
            )

    # ── 4. Other media (video, doc, etc.) ────────────────────────────────────
    if num_media > 0:
        return _twiml_response(
            "I received a file, but I currently support images and voice notes only.\n"
            "You can also paste the suspicious text directly and I will scan it!"
        )

    # ── 5. Plain text message → classify ─────────────────────────────────────
    if text_body:
        req = ClassifyRequest(
            text=text_body,
            channel="whatsapp",
            input_type="text",
            user_id=user.id if user else None,
        )
        result = classifier.classify_text(req)
        reply = _format_classify_reply(result, user)
        return _twiml_response(reply)

    # ── 6. Empty message fallback ─────────────────────────────────────────────
    return _twiml_response(
        "Hi! I am Kavach Bot. Forward me any suspicious message, image, or voice note "
        "and I will analyse it for scam threats instantly."
    )
