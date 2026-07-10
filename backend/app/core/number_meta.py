"""Factual reference data for number intelligence.

Everything here is deliberately conservative: it encodes what a phone number's
*prefix* tells you for certain (its shape, and — for India — the telecom
circle/LSA the series was *originally allocated to* by DoT), and nothing more.

Two important honesty notes baked into how this module is used downstream:

1. Mobile Number Portability (MNP), live pan-India since 2011 (intra-circle)
   and January 2011 / 2015 (full), decouples a number's *original* operator
   and even its *current* serving circle from the digit prefix. A "70xx"
   number originally allocated to Airtel-Maharashtra could today be an
   active Jio number ported by a subscriber who has since moved to Delhi.
   We therefore NEVER assert a current operator from the prefix — we only
   surface the *original allocation circle* with an explicit MNP caveat.
   See: https://en.wikipedia.org/wiki/Mobile_telephone_numbering_in_India

2. TRAI number series carry real regulatory meaning that we *can* state
   as fact:
     - 140xxxxxxx  — reserved for promotional/telemarketing voice calls.
     - 1600xxxxxx / 1601xxxxxx — reserved (from May 2024 direction, phased
       compliance through 2026) for verified service/transactional voice
       calls from government and RBI/SEBI/IRDAI/PFRDA-regulated financial
       entities. Spoofing this series is the newer fraud vector TRAI built
       160/1600 specifically to counter — so a call *claiming* to be 1600
       series that doesn't structurally match it is itself a red flag.
     - 1800xxxxxx  — toll-free.
"""
from __future__ import annotations

from dataclasses import dataclass

MNP_CAVEAT = (
    "Since Mobile Number Portability (MNP), a number's original circle does not "
    "guarantee its current operator or the caller's actual location — treat this "
    "as historical context, not proof of identity."
)

# ── Telecom circles (Licensed Service Areas) — original MSC-code allocation ──
# Keyed by 2-digit prefix of the subscriber number (first two digits after the
# leading 6/7/8/9 digit is not how DoT allocates — allocation is by the full
# first 4-5 digits (MSC code) per operator per circle). Because complete,
# authoritative MSC-to-circle tables are not publicly machine-readable and
# change over time, we deliberately keep this coarse (leading-2-digit bands
# commonly cited in DoT-derived public numbering references) and ALWAYS label
# it "original allocation circle" with the MNP caveat attached — never a
# current-operator claim.
TELECOM_CIRCLES: list[tuple[str, str]] = [
    ("70", "Maharashtra (incl. Mumbai)"),
    ("74", "Maharashtra (incl. Mumbai)"),
    ("75", "Maharashtra (incl. Mumbai)"),
    ("76", "Gujarat"),
    ("77", "Gujarat"),
    ("78", "North East"),
    ("79", "Andhra Pradesh / Telangana"),
    ("80", "Karnataka"),
    ("81", "Kerala"),
    ("82", "Tamil Nadu (incl. Chennai)"),
    ("83", "Tamil Nadu (incl. Chennai)"),
    ("84", "Kerala"),
    ("85", "Odisha"),
    ("86", "Madhya Pradesh / Chhattisgarh"),
    ("87", "Bihar / Jharkhand"),
    ("88", "Punjab / Haryana"),
    ("89", "Uttar Pradesh"),
    ("90", "Uttar Pradesh"),
    ("91", "West Bengal (incl. Kolkata)"),
    ("92", "Rajasthan"),
    ("93", "Tamil Nadu (incl. Chennai)"),
    ("94", "Karnataka"),
    ("95", "Andhra Pradesh / Telangana"),
    ("96", "Rajasthan"),
    ("97", "Gujarat"),
    ("98", "Delhi NCR / Maharashtra (early GSM band, mixed)"),
    ("99", "Delhi NCR"),
    ("60", "Rajasthan / Assam / Tamil Nadu (Jio 6-series launch band)"),
    ("61", "Punjab / Haryana / Uttar Pradesh (Jio 6-series band)"),
    ("62", "North East / West Bengal (Jio 6-series band)"),
    ("63", "Karnataka / Tamil Nadu (Jio 6-series band)"),
    ("64", "Kerala / Andhra Pradesh (Jio 6-series band)"),
    ("65", "Madhya Pradesh / Maharashtra (Jio 6-series band)"),
    ("66", "Gujarat / Rajasthan (Jio 6-series band)"),
    ("67", "Bihar / Odisha (Jio 6-series band)"),
    ("68", "Uttar Pradesh (Jio 6-series band)"),
    ("69", "Delhi NCR / Punjab (Jio 6-series band)"),
]


def original_allocation_circle(number_10digit: str) -> str | None:
    """Best-effort *original allocation* circle from the leading 2 digits.

    Only meaningful for 10-digit Indian mobile numbers starting with 6-9.
    Always pair the result with MNP_CAVEAT when shown to a user.
    """
    if len(number_10digit) != 10 or number_10digit[0] not in "6789":
        return None
    prefix = number_10digit[:2]
    for pfx, circle in TELECOM_CIRCLES:
        if prefix == pfx:
            return circle
    return None


# ── Special TRAI-regulated series ────────────────────────────────────────────
@dataclass(frozen=True)
class SpecialSeries:
    key: str
    label: str
    description: str


SPECIAL_SERIES: list[tuple[str, SpecialSeries]] = [
    (
        "1600",
        SpecialSeries(
            key="verified_1600",
            label="Verified Service/Transactional Number (1600 series)",
            description=(
                "1600-series numbers are reserved by TRAI/DoT for service and "
                "transactional voice calls from government bodies and RBI/SEBI/"
                "IRDAI/PFRDA-regulated financial entities (banks, insurers, "
                "brokers). This is the strongest current 'this is a real "
                "institution calling' number-format signal in India."
            ),
        ),
    ),
    (
        "1601",
        SpecialSeries(
            key="verified_1601",
            label="Verified Financial-Sector Number (1601 series)",
            description=(
                "1601-series numbers are reserved for RBI/SEBI/IRDAI/PFRDA-"
                "regulated private financial institutions for transactional "
                "voice calls."
            ),
        ),
    ),
    (
        "140",
        SpecialSeries(
            key="promotional_140",
            label="Promotional / Telemarketing Number (140 series)",
            description=(
                "140-series numbers are reserved by TRAI for promotional and "
                "telemarketing calls only. A 140-series caller claiming to be "
                "your bank, the police, or a courier company is a strong "
                "mismatch — regulated transactional calls now use 1600/1601, "
                "not 140."
            ),
        ),
    ),
    (
        "1800",
        SpecialSeries(
            key="toll_free_1800",
            label="Toll-Free Number (1800 series)",
            description="1800-series numbers are toll-free helplines.",
        ),
    ),
]


def match_special_series(number: str) -> SpecialSeries | None:
    digits = "".join(ch for ch in number if ch.isdigit())
    # Strip a leading country code (91) if present, since series prefixes are
    # defined on the national significant number.
    if digits.startswith("91") and len(digits) > 10:
        digits = digits[2:]
    for prefix, series in SPECIAL_SERIES:
        if digits.startswith(prefix):
            return series
    return None


# ── Country dial codes — used to label international numbers honestly ───────
@dataclass(frozen=True)
class CountryInfo:
    iso: str
    name: str
    expected_length: int  # national significant number length, best-effort
    cross_border_fraud_risk: str  # "low" | "medium" | "high"


COUNTRY_DIAL_CODES: dict[str, CountryInfo] = {
    "91": CountryInfo("IN", "India", 10, "low"),
    "92": CountryInfo("PK", "Pakistan", 10, "high"),
    "880": CountryInfo("BD", "Bangladesh", 10, "high"),
    "86": CountryInfo("CN", "China", 11, "high"),
    "234": CountryInfo("NG", "Nigeria", 10, "high"),
    "1": CountryInfo("US/CA", "USA / Canada", 10, "low"),
    "44": CountryInfo("GB", "United Kingdom", 10, "low"),
    "971": CountryInfo("AE", "UAE", 9, "medium"),
    "966": CountryInfo("SA", "Saudi Arabia", 9, "medium"),
    "94": CountryInfo("LK", "Sri Lanka", 9, "medium"),
    "977": CountryInfo("NP", "Nepal", 10, "medium"),
    "95": CountryInfo("MM", "Myanmar", 9, "high"),
    "7": CountryInfo("RU", "Russia", 10, "medium"),
    "60": CountryInfo("MY", "Malaysia", 9, "medium"),
    "63": CountryInfo("PH", "Philippines", 10, "high"),
    "255": CountryInfo("TZ", "Tanzania", 9, "high"),
    "27": CountryInfo("ZA", "South Africa", 9, "medium"),
}


def country_for_dial_code(dial_code: str) -> CountryInfo | None:
    return COUNTRY_DIAL_CODES.get(dial_code.lstrip("+"))


@dataclass
class NumberShape:
    """A purely structural read of a number — no fraud judgement here."""

    normalized: str          # digits only, no leading country code if IN
    dial_code: str            # e.g. "91"
    national_number: str      # digits after the dial code
    is_india: bool
    is_valid_shape: bool      # matches the expected length/leading-digit rules
    number_type: str          # "mobile" | "toll_free" | "service_1600" | "unknown"
    special_series: SpecialSeries | None
    circle: str | None        # original allocation circle (India mobile only)
    country: CountryInfo | None


def classify_number_shape(raw: str) -> NumberShape:
    """Deterministically parse a raw phone-number string into its structural
    facts. Contains no fraud scoring — that lives in number_intel.py, which
    consumes this.
    """
    digits = "".join(ch for ch in raw if ch.isdigit())

    dial_code = "91"
    national = digits
    is_india = True

    # Special TRAI series (140/1600/1601/1800) are short-code-like national
    # numbers that don't follow the 10-digit-starting-6789 mobile shape —
    # check for them before falling back to international dial-code matching,
    # otherwise e.g. "140..." gets misread as a "+1" US/Canada number.
    special_probe = digits[2:] if digits.startswith("91") and len(digits) > 10 else digits
    special = match_special_series(special_probe)

    if special:
        dial_code, national = "91", special_probe
    elif digits.startswith("91") and len(digits) > 10:
        dial_code, national = "91", digits[2:]
    elif digits.startswith("0") and len(digits) == 11:
        # Trunk-prefixed Indian number e.g. 0-9876543210
        dial_code, national = "91", digits[1:]
    elif len(digits) == 10 and digits[0] in "6789":
        dial_code, national = "91", digits
    else:
        # Try to match a known international dial code by longest prefix
        is_india = False
        for code in sorted(COUNTRY_DIAL_CODES, key=len, reverse=True):
            if digits.startswith(code):
                dial_code, national = code, digits[len(code):]
                is_india = code == "91"
                break
        else:
            dial_code, national = "", digits

    country = country_for_dial_code(dial_code) if dial_code else None

    if is_india:
        if special and special.key.startswith("verified"):
            number_type = "service_1600"
            is_valid_shape = True
        elif special and special.key == "promotional_140":
            number_type = "promotional"
            is_valid_shape = True
        elif special and special.key == "toll_free_1800":
            number_type = "toll_free"
            is_valid_shape = True
        elif len(national) == 10 and national[0] in "6789":
            number_type = "mobile"
            is_valid_shape = True
        else:
            number_type = "unknown"
            is_valid_shape = False
        circle = original_allocation_circle(national) if number_type == "mobile" else None
    else:
        expected = country.expected_length if country else None
        number_type = "mobile" if not special else "service"
        is_valid_shape = expected is None or len(national) == expected
        circle = None

    return NumberShape(
        normalized=digits,
        dial_code=dial_code,
        national_number=national,
        is_india=is_india,
        is_valid_shape=is_valid_shape,
        number_type=number_type,
        special_series=special,
        circle=circle,
        country=country,
    )


CATEGORY_LABELS: dict[str, str] = {
    "digital_arrest": "Digital Arrest",
    "kyc_fraud": "KYC Fraud",
    "bank_impersonation": "Bank Impersonation",
    "loan_fraud": "Loan Recovery Threats",
    "investment_fraud": "Investment Scam",
    "delivery_customs": "Fake Courier / Customs",
    "sextortion": "Sextortion",
    "otp_theft": "OTP Theft",
    "lottery_fraud": "Lottery / Prize Scam",
    "utility_disconnection": "Utility Disconnection Threat",
    "task_job": "Task / Job Scam",
    "international_scam": "International Scam",
    "impersonation": "Impersonation",
    "spam": "Spam / Marketing",
    "other": "Other",
}
