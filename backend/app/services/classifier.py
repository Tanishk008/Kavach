"""The shared classifier core.

One deterministic rule engine, called by every front door (app, WhatsApp,
IVR transcript). No client is allowed to run its own parallel logic — this
module is the single source of truth for message risk classification, per
the "one classifier core, three front doors" design principle.

Design:
  1. A legitimate-transaction-SMS recognizer runs first. If the message
     structurally matches a real bank/NBFC transaction alert (masked
     account, transaction verb, amount, standard phrasing) AND contains no
     suspicious URL, it is short-circuited to `safe` — this prevents good
     bank SMS from being drowned out by generic keyword matches.
  2. Otherwise, a weighted keyword/phrase taxonomy scores the message across
     known scam categories (digital arrest, KYC fraud, bank impersonation,
     utility disconnection, task/job scams, lottery, courier/customs, loan
     recovery, investment, sextortion, OTP theft, violent threats).
  3. Every URL in the message is run through app/core/url_analysis.py; its
     score is added and its signals become part of the reasons.
  4. Score → tier via fixed thresholds. Same input, same output — always.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.config import get_settings
from app.core.playbooks import get_playbook
from app.core.url_analysis import UrlFinding, analyze_text_urls
from app.schemas.classification import (
    ClassifyRequest,
    ClassifyResponse,
    Extracted,
    Playbook,
    PlaybookStep,
    UrlFinding as UrlFindingSchema,
    VoiceSignal,
)
from app.schemas.common import VerdictTier

settings = get_settings()


# ── Legitimate transaction-SMS recognizer ────────────────────────────────────
_MASKED_ACCOUNT_RE = re.compile(r"(a/?c|acct|account)?\s*(no)?\.?\s*[:\-]?\s*[x*]+\d{3,4}", re.I)
_TXN_VERB_RE = re.compile(r"\b(withdrawn|debited|credited|deducted|txn|transaction|neft|imps|rtgs|utr\s*[a-z0-9]+)\b", re.I)
_AMOUNT_RE = re.compile(r"(rs\.?|inr|₹)\s*\.?\s*[\d,]+(\.\d{1,2})?", re.I)
_SECURITY_PHRASE_RE = re.compile(r"(if not you|not you,?\s*call|block your card|call 1800|forward this sms|batchid|info:)", re.I)


def is_legitimate_transaction_sms(text: str) -> bool:
    has_masked_account = bool(_MASKED_ACCOUNT_RE.search(text))
    has_txn = bool(_TXN_VERB_RE.search(text))
    has_amount = bool(_AMOUNT_RE.search(text))
    has_security_phrase = bool(_SECURITY_PHRASE_RE.search(text))
    return has_txn and has_amount and (has_masked_account or has_security_phrase)


# ── Weighted taxonomy ─────────────────────────────────────────────────────
@dataclass
class _Signal:
    scam_type: str
    keywords: list[str]
    reason: str
    weight: int


_SIGNALS: list[_Signal] = [
    _Signal("digital_arrest", ["arrest", "cbi", " ed ", "customs", "money laundering",
                                "police", "warrant", "digital arrest", "narcotics"],
            "Impersonates a law-enforcement / government authority", 30),
    _Signal("digital_arrest", ["clearance fee", "verification fee", "stay on camera",
                                "video call", "do not tell anyone", "don't tell", "skype"],
            "Uses urgency and isolation tactics (a hallmark of digital arrest scams)", 30),
    _Signal("kyc_fraud", ["update kyc", "kyc update", "kyc expire", "kyc will be",
                           "pan card block", "pan will be blocked", "re-kyc"],
            "Creates fake urgency about KYC/PAN suspension", 28),
    _Signal("bank_impersonation", ["dear customer", "sbi customer", "hdfc bank",
                                    "icici bank", "axis bank", "account suspended",
                                    "account blocked", "account will be blocked",
                                    "your account has been"],
            "Impersonates a bank using generic 'dear customer' framing", 22),
    _Signal("utility_disconnection", ["electricity", "power will be disconnected",
                                       "disconnected tonight", "disconnect your service",
                                       "gas connection", "meter reading pending"],
            "Threatens immediate utility disconnection to force urgent action", 26),
    _Signal("task_job", ["work from home", "earn daily", "part time job", "youtube likes",
                          "easy income", "join telegram to earn", "task and earn",
                          "guaranteed income", "rs 3000 per day"],
            "Promises unrealistic daily earnings for simple tasks (task-scam pattern)", 25),
    _Signal("lottery_fraud", ["lucky draw", "lottery", "won 25 lakh", "kbc", "you have won",
                               "claim prize", "jio lucky draw", "congratulations you have won"],
            "Claims an unsolicited lottery/prize win", 27),
    _Signal("loan_fraud", ["loan", "processing fee", "instant loan", "emi", "recovery agent",
                            "loan app", "pre-approved loan"],
            "Fake loan / recovery pressure", 20),
    _Signal("investment_fraud", ["guaranteed return", "double your money", "trading tips",
                                  "investment", "stock tips", "sure shot profit"],
            "Promises unrealistic guaranteed returns", 22),
    _Signal("delivery_customs", ["parcel", "courier", "customs duty", "fedex", "package held",
                                  "package is held", "delivery failed", "shipment on hold"],
            "Fake delivery / customs fee request", 20),
    _Signal("sextortion", ["video will be leaked", "nude", "leaked", "screen recorded",
                            "recorded your", "morphed"],
            "Threat to leak private material (sextortion)", 32),
    _Signal("otp_theft", ["share your otp", "share the otp", "otp is", "tell me the otp",
                           "share your pin", "share your cvv", "upi pin"],
            "Directly requests an OTP, PIN, or CVV — no legitimate entity ever asks for this", 30),
    _Signal("other", ["urgent", "immediately", "pay now", "act now", "final warning",
                       "last chance"],
            "Uses high-pressure urgency language typical of scam messaging", 8),
]

_VIOLENT_THREAT_RE = re.compile(
    r"\b(kill|murder|bomb|kidnap|shoot|stab|death threat|die\b|beat you|hit you|"
    r"hurt you|assault|destroy you|slap you|punch you|smash your)\b", re.I,
)


@dataclass
class _Analysis:
    reasons: list[str] = field(default_factory=list)
    score: int = 0
    scam_type: str | None = None
    url_findings: list[UrlFinding] = field(default_factory=list)
    keywords_hit: list[str] = field(default_factory=list)


def _mock_classify(text: str) -> _Analysis:
    lowered = f" {text.lower()} "
    analysis = _Analysis()

    # Violent threat is a distinct, immediate-safety category — check first,
    # independent of the scam-scoring taxonomy.
    if _VIOLENT_THREAT_RE.search(lowered):
        analysis.scam_type = "violent_threat"
        analysis.score = 100
        analysis.reasons.append("Message contains explicit violent or threatening language")
        analysis.reasons.append("This is treated as a severe physical-safety risk, not a scam pattern")
        return analysis

    scam_type_votes: dict[str, int] = {}
    for sig in _SIGNALS:
        hits = [kw for kw in sig.keywords if kw in lowered]
        if hits:
            analysis.reasons.append(sig.reason)
            analysis.score += sig.weight
            analysis.keywords_hit.extend(h.strip() for h in hits)
            if sig.scam_type != "other":
                scam_type_votes[sig.scam_type] = scam_type_votes.get(sig.scam_type, 0) + sig.weight

    # URL analysis — always run, regardless of keyword matches.
    findings = analyze_text_urls(text)
    analysis.url_findings = findings
    protected_brands = ["sbi", "hdfc", "icici", "axisbank", "paytm", "rbi", "kotak", "pnb"]
    for f in findings:
        if f.risk_score > 0:
            analysis.score += f.risk_score
            for s in f.signals:
                analysis.reasons.append(f"Link '{f.url}': {s}")
            # A convincingly malicious URL is itself strong evidence of phishing.
            if f.risk_score >= 40:
                url_scam_type = (
                    "bank_impersonation"
                    if any(b in f.url.lower() for b in protected_brands)
                    else "otp_theft"
                )
                scam_type_votes[url_scam_type] = scam_type_votes.get(url_scam_type, 0) + f.risk_score

    if scam_type_votes:
        analysis.scam_type = max(scam_type_votes, key=scam_type_votes.get)
    return analysis


def _llm_classify(text: str) -> _Analysis:  # pragma: no cover - integration point
    raise NotImplementedError("Wire the LLM provider here; unset LLM_API_KEY to use the mock.")


def _score_to_tier(score: int) -> tuple[VerdictTier, float]:
    if score >= 50:
        return VerdictTier.high_risk, min(0.97, 0.65 + 0.003 * score)
    if score >= 20:
        return VerdictTier.caution, 0.55 + 0.003 * score
    return VerdictTier.safe, 0.6


def _merge_voice_signal(
    tier: VerdictTier, deepfake_likelihood: str | None
) -> tuple[VerdictTier, VoiceSignal | None]:
    if not deepfake_likelihood:
        return tier, None
    note = "Voice authenticity assessed separately from message content."
    signal = VoiceSignal(deepfake_likelihood=deepfake_likelihood, note=note)
    if deepfake_likelihood == "high" and tier == VerdictTier.caution:
        return VerdictTier.high_risk, signal
    return tier, signal


_PHONE_RE = re.compile(r"(?:\+?91[\s-]?)?[6-9]\d{9}\b")


def classify_text(req: ClassifyRequest) -> ClassifyResponse:
    text = req.text

    # ── Legitimate-transaction-SMS short-circuit ────────────────────────────
    url_findings_all = analyze_text_urls(text)
    has_suspicious_url = any(f.risk_score >= 25 for f in url_findings_all)

    if is_legitimate_transaction_sms(text) and not has_suspicious_url:
        tier = VerdictTier.safe
        confidence = 0.9
        scam_type = None
        reasons = [
            "Matches the structural format of a genuine bank/NBFC transaction alert",
            "Contains a masked account number and standard transaction details",
            "No suspicious links detected in the message",
        ]
        analysis_score = 3
        extracted = Extracted(
            urls=[UrlFindingSchema(**f.to_dict()) for f in url_findings_all],
            keywords=[],
            phone_numbers=_PHONE_RE.findall(text),
        )
    else:
        analysis = (
            _mock_classify(text) if settings.use_mock_classifier else _llm_classify(text)
        )
        tier, confidence = _score_to_tier(analysis.score)
        if not analysis.reasons:
            analysis.reasons = ["No known scam patterns detected — but always verify independently."]
        scam_type = analysis.scam_type
        reasons = analysis.reasons
        analysis_score = analysis.score
        extracted = Extracted(
            urls=[UrlFindingSchema(**f.to_dict()) for f in analysis.url_findings],
            keywords=sorted(set(analysis.keywords_hit)),
            phone_numbers=_PHONE_RE.findall(text),
        )

    tier, voice_signal = _merge_voice_signal(tier, req.voice_deepfake_likelihood)

    playbook_data = None
    if tier != VerdictTier.safe:
        pb = get_playbook(scam_type)
        playbook_data = Playbook(
            id=pb["id"],
            title=pb["title"],
            steps=[PlaybookStep(order=i + 1, text=s) for i, s in enumerate(pb["steps"])],
        )

    return ClassifyResponse(
        tier=tier,
        confidence=round(confidence, 2),
        scam_type=scam_type,
        reasons=reasons,
        playbook=playbook_data,
        voice_signal=voice_signal,
        risk_score=min(100, analysis_score),
        extracted=extracted,
    )
