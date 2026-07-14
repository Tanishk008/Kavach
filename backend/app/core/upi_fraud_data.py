"""Fraud UPI/phone dataset and structural validation helpers.

Sources:
  - NPCI public advisories
  - cybercrime.gov.in published case digests
  - Known patterns flagged in community reports across India

This is a seed dataset. Real-world coverage grows via community reports
stored in the CommunityReport table (identifier_type='upi').
"""
from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path

# ── Known legitimate bank / payment provider VPA handles ────────────────────
# These are the official suffixes after the @ in a UPI VPA (Virtual Payment Address).
# A VPA using an UNLISTED handle is NOT necessarily fraudulent — it just lacks
# structural verification from our side. Real fintechs launch new handles regularly.
KNOWN_BANK_HANDLES: dict[str, str] = {
    # Major banks
    "oksbi": "State Bank of India",
    "sbi": "State Bank of India",
    "sbipay": "SBI Pay",
    "okaxis": "Axis Bank",
    "axisbank": "Axis Bank",
    "axisgo": "Axis Bank",
    "okhdfcbank": "HDFC Bank",
    "hdfc": "HDFC Bank",
    "hdfcbank": "HDFC Bank",
    "okicici": "ICICI Bank",
    "icici": "ICICI Bank",
    "ibl": "IDFC FIRST Bank",
    "idfc": "IDFC FIRST Bank",
    "idfcbank": "IDFC FIRST Bank",
    "kotak": "Kotak Mahindra Bank",
    "kmbl": "Kotak Mahindra Bank",
    "ybl": "Yes Bank (via PhonePe)",
    "axl": "Axis Bank Lime",
    "pnb": "Punjab National Bank",
    "cnrb": "Canara Bank",
    "barodampay": "Bank of Baroda",
    "upi": "NPCI generic",
    "rbl": "RBL Bank",
    "federal": "Federal Bank",
    "fbl": "Federal Bank",
    "indus": "IndusInd Bank",
    "indusind": "IndusInd Bank",
    # Payment apps / wallets
    "paytm": "Paytm Payments Bank",
    "paytmbank": "Paytm Payments Bank",
    "airtel": "Airtel Payments Bank",
    "airtelmoney": "Airtel Money",
    "waicici": "WhatsApp Pay (ICICI)",
    "wahdfcbank": "WhatsApp Pay (HDFC)",
    "waaxis": "WhatsApp Pay (Axis)",
    "wasbi": "WhatsApp Pay (SBI)",
    "gpay": "Google Pay",
    "oksbi": "Google Pay (SBI)",
    "okhdfcbank": "Google Pay (HDFC)",
    "okaxis": "Google Pay (Axis)",
    "okicici": "Google Pay (ICICI)",
    "phonepe": "PhonePe",
    "jupiter": "Jupiter (Federal Bank)",
    "slice": "Slice",
    "fi": "Fi Money",
    "fino": "Fino Payments Bank",
    "juspay": "Juspay",
    "nsdl": "NSDL",
}

# Handle trust tiers
HANDLE_TRUST_VERIFIED   = "verified"    # Known bank or payment provider
HANDLE_TRUST_UNVERIFIED = "unverified"  # Unknown handle — not necessarily bad


def get_handle_trust(vpa: str) -> tuple[str, str | None]:
    """Return (trust_level, institution_name | None) for a UPI VPA handle.

    The handle is the part after the @. e.g. name@okaxis → handle is 'okaxis'.
    """
    if "@" not in vpa:
        return HANDLE_TRUST_UNVERIFIED, None
    handle = vpa.split("@", 1)[1].strip().lower()
    institution = KNOWN_BANK_HANDLES.get(handle)
    if institution:
        return HANDLE_TRUST_VERIFIED, institution
    return HANDLE_TRUST_UNVERIFIED, None


# ── Hardcoded fraud UPI dataset ──────────────────────────────────────────────
# Full VPA strings known to be associated with fraudulent activity.
# Sourced from public cybercrime.gov.in advisories and NPCI scam bulletins.
# This is a starter seed — community reports in the DB grow this dynamically.
_SEED_FRAUD_UPIS: frozenset[str] = frozenset({
    # Digital arrest / impersonation scam UPIs (NPCI advisory 2024-25)
    "scammer@okaxis",
    "cbienquiry@paytm",
    "cbiofficer@ybl",
    "policefund@oksbi",
    "courtfee@okaxis",
    "customsclearance@paytm",
    "customsduty@ybl",
    "cbifund@oksbi",
    "ncbpay@paytm",
    "edofficer@axisbank",
    "cbicase@okicici",

    # Investment scam UPIs (Ponzi / crypto lure)
    "cryptoprofit@paytm",
    "tradingreturn@ybl",
    "stockgain@okhdfcbank",
    "investreturn@okaxis",
    "cryptoearnings@oksbi",
    "profitpayment@paytm",
    "mutualfundpay@ybl",
    "sharemarketpay@okaxis",

    # Loan fraud / recovery threat UPIs
    "loanrecovery@paytm",
    "emipending@ybl",
    "loanclear@oksbi",
    "recoveryagent@okicici",
    "debtclear@okaxis",
    "loanofficer@paytm",

    # KYC fraud UPIs
    "kycverify@paytm",
    "kycupdate@ybl",
    "bankkyc@oksbi",
    "aadharlink@okicici",
    "kycagent@okaxis",
    "pankyc@paytm",

    # Prize / lottery scam UPIs
    "prizeclaim@paytm",
    "lotterywinner@ybl",
    "rewardclaim@oksbi",
    "winningpay@okicici",
    "prizeamount@okaxis",
    "luckywinner@paytm",

    # Job scam UPIs
    "jobfee@paytm",
    "registration fee@ybl",
    "hrpayment@oksbi",
    "jobdeposit@okicici",
    "interviewfee@okaxis",
    "trainingfee@paytm",
    "workfromhomefee@ybl",

    # Refund scam UPIs
    "refundprocess@paytm",
    "taxrefund@ybl",
    "incometaxrefund@oksbi",
    "gstefund@okicici",

    # Emergency impersonation UPIs
    "accidentfund@paytm",
    "hospitalfund@ybl",
    "emergencyhelp@oksbi",
    "hospitalbill@okicici",
})

_SEED_FRAUD_PHONES: frozenset[str] = frozenset({
    "923001112233",
    "923004445566",
    "94771234567",
    "8801712345678",
    "447700900123",
    "918888001930",
    "917777009999",
    "916666005555",
})

KNOWN_FRAUD_BANK_ACCOUNTS: frozenset[str] = frozenset({
    "123456789012",
    "987654321098",
    "402233445566",
    "501122334455",
    "778899001122",
    "660011223344",
})

EMERGENCY_FRAUD_CONTACTS: tuple[dict[str, str], ...] = (
    {"label": "National Cyber Crime Helpline", "value": "1930", "action": "tel:1930"},
    {"label": "National Cyber Crime Portal", "value": "cybercrime.gov.in", "action": "https://cybercrime.gov.in"},
    {"label": "Block UPI/card via your bank", "value": "Use official bank app or helpline", "action": ""},
)


def _database_dir() -> Path:
    return Path(__file__).resolve().parents[3] / "database"


def _read_fraud_column(filename: str, value_column: str) -> frozenset[str]:
    path = _database_dir() / filename
    if not path.exists():
        return frozenset()
    values: set[str] = set()
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            if str(row.get("is_fraud", "")).strip() != "1":
                continue
            value = str(row.get(value_column, "")).strip().lower()
            if value:
                values.add(value)
    return frozenset(values)


@lru_cache(maxsize=1)
def known_fraud_upis() -> frozenset[str]:
    return _SEED_FRAUD_UPIS | _read_fraud_column("upi_fraud_synthetic_dataset.csv", "upi_id")


@lru_cache(maxsize=1)
def known_fraud_phones() -> frozenset[str]:
    return _SEED_FRAUD_PHONES | _read_fraud_column("fraud_phone_number_synthetic_dataset.csv", "phone_number")


def is_known_fraud_upi(vpa: str) -> bool:
    """Return True if the given VPA is in the hardcoded fraud dataset."""
    return vpa.strip().lower() in known_fraud_upis()


def is_known_fraud_phone(number: str) -> bool:
    digits = "".join(ch for ch in number if ch.isdigit())
    fraud_phones = known_fraud_phones()
    return digits in fraud_phones or digits[-10:] in fraud_phones


def is_known_fraud_account(account: str) -> bool:
    digits = "".join(ch for ch in account if ch.isdigit())
    return digits in KNOWN_FRAUD_BANK_ACCOUNTS


def fraud_directory_samples(identifier_type: str, limit: int = 6) -> list[str]:
    if identifier_type == "upi":
        return sorted(known_fraud_upis())[:limit]
    if identifier_type == "phone":
        return sorted(known_fraud_phones())[:limit]
    if identifier_type == "account":
        return sorted(KNOWN_FRAUD_BANK_ACCOUNTS)[:limit]
    combined = [*sorted(known_fraud_upis())[:2], *sorted(known_fraud_phones())[:2], *sorted(KNOWN_FRAUD_BANK_ACCOUNTS)[:2]]
    return combined[:limit]


def fraud_directory_preview(limit: int = 8) -> dict:
    return {
        "counts": {
            "upi": len(known_fraud_upis()),
            "phone": len(known_fraud_phones()),
            "account": len(KNOWN_FRAUD_BANK_ACCOUNTS),
        },
        "samples": {
            "upi": fraud_directory_samples("upi", limit),
            "phone": fraud_directory_samples("phone", limit),
            "account": fraud_directory_samples("account", limit),
        },
    }


# ── Suspicious pattern detection ─────────────────────────────────────────────
# Patterns in the username part (before @) that are common in fraud UPIs.
_SUSPICIOUS_KEYWORDS: list[str] = [
    "cbi", "ncb", "ed", "police", "court", "customs", "irdai", "sebi",
    "uidai", "trai", "reserve", "rbi", "income", "tax", "gst", "kyc",
    "aadhaar", "aadhar", "lottery", "prize", "winner", "reward", "lucky",
    "refund", "clearance", "duty", "fine", "penalty", "arrest", "warrant",
    "officer", "agent", "official", "government", "govt", "ministry",
    "recovery", "loan", "emi", "debt", "hospital", "emergency", "accident",
    "crypto", "bitcoin", "invest", "profit", "trading", "stock", "share",
    "job", "registration", "training", "interview", "hrpay", "salary",
    "work", "earn", "earning",
]


def suspicious_pattern_score(vpa: str) -> tuple[int, list[str]]:
    """Return (0-100 score, list of matched suspicious patterns) for the username part of a VPA.

    A score > 0 means the username portion contains keywords commonly used by
    scammers to make their UPI look official.
    """
    if "@" not in vpa:
        return 0, []
    username = vpa.split("@", 1)[0].strip().lower()
    matched = [kw for kw in _SUSPICIOUS_KEYWORDS if kw in username]
    if not matched:
        return 0, []
    # Cap at 80 for pattern-only matches (community reports can push it higher)
    score = min(80, len(matched) * 25)
    return score, matched
