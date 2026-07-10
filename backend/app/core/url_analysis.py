"""Deterministic URL/phishing-link analysis — no external calls, no ML.

Every check here is a structural/lexical fact about the URL string itself:
shortener domains, raw-IP hosts, punycode/homograph encoding, suspicious
TLDs, brand-lookalike domains (edit-distance against common Indian bank/
government brands), .apk downloads, and plain HTTP. Each finding carries a
fixed weight so the same URL always scores the same way.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from urllib.parse import urlparse

# Matches either a raw-IP host or a domain whose final label (the TLD) is
# alphabetic. Requiring an alpha TLD is what keeps this from false-matching
# ordinary decimal amounts in message text (e.g. "Rs.15" or "debited 000.00",
# whose "TLD" would otherwise be a numeric fragment).
_URL_RE = re.compile(
    r"(?:https?://)?(?:www\.)?"
    r"(?:\d{1,3}(?:\.\d{1,3}){3}"
    r"|[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
    r"(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*"
    r"\.[a-zA-Z]{2,24})"
    r"(?:/[^\s]*)?",
    re.IGNORECASE,
)

_SHORTENER_DOMAINS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "buff.ly", "ow.ly",
    "rebrand.ly", "cutt.ly", "shorturl.at", "tiny.cc", "rb.gy", "s.id",
}

_SUSPICIOUS_TLDS = {
    "xyz", "top", "click", "link", "work", "loan", "win", "gq", "tk", "ml",
    "cf", "ga", "info", "biz", "icu", "cam", "buzz",
}

_CREDENTIAL_PATH_WORDS = (
    "login", "verify", "update-kyc", "kyc-update", "secure", "confirm",
    "account-verify", "password", "reset", "unlock", "otp", "block",
)

# Brands commonly impersonated in Indian phishing campaigns; used for
# edit-distance lookalike detection against the registrable domain.
_PROTECTED_BRANDS = [
    "sbi", "hdfc", "icici", "axisbank", "paytm", "rbi", "kotak", "pnb",
    "indusind", "yesbank", "gov", "uidai", "irctc", "indiapost", "npci",
]


def extract_urls(text: str) -> list[str]:
    found = _URL_RE.findall(text)
    # Dedup preserving order
    seen: dict[str, None] = {}
    for u in found:
        seen.setdefault(u, None)
    return list(seen.keys())


def _levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i] + [0] * len(b)
        for j, cb in enumerate(b, 1):
            cost = 0 if ca == cb else 1
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
        prev = cur
    return prev[-1]


def _registrable_host(host: str) -> str:
    """Strip a leading www. and return the bare host for comparisons."""
    return host[4:] if host.startswith("www.") else host


def _is_punycode(host: str) -> bool:
    return any(label.startswith("xn--") for label in host.split("."))


def _is_raw_ip(host: str) -> bool:
    return bool(re.fullmatch(r"\d{1,3}(?:\.\d{1,3}){3}", host))


def _brand_lookalike(host: str) -> str | None:
    """Return the brand name being impersonated, if the host is a close
    (but not exact) match to a protected brand within a plausible domain.
    """
    core = _registrable_host(host).split(".")[0]
    core_clean = re.sub(r"[^a-z0-9]", "", core.lower())
    for brand in _PROTECTED_BRANDS:
        if core_clean == brand:
            continue  # exact match is legitimate (or at least not a lookalike)
        if brand in core_clean and len(core_clean) - len(brand) <= 6:
            return brand
        if len(core_clean) >= 3 and _levenshtein(core_clean, brand) <= 1:
            return brand
    return None


@dataclass
class UrlFinding:
    url: str
    risk_score: int = 0
    signals: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {"url": self.url, "risk_score": self.risk_score, "signals": self.signals}


def analyze_url(raw_url: str) -> UrlFinding:
    finding = UrlFinding(url=raw_url)
    candidate = raw_url if "://" in raw_url else f"http://{raw_url}"
    parsed = urlparse(candidate)
    host = (parsed.hostname or "").lower()
    path = (parsed.path or "").lower()

    if not host:
        return finding

    if host in _SHORTENER_DOMAINS:
        finding.signals.append("Uses a link-shortener, hiding the real destination")
        finding.risk_score += 25

    if _is_raw_ip(host):
        finding.signals.append("Points to a raw IP address instead of a domain name")
        finding.risk_score += 30

    if _is_punycode(host):
        finding.signals.append("Uses punycode encoding — often used to fake a trusted domain (homograph attack)")
        finding.risk_score += 35

    tld = host.rsplit(".", 1)[-1] if "." in host else ""
    if tld in _SUSPICIOUS_TLDS:
        finding.signals.append(f"Uses the .{tld} domain extension, uncommon for legitimate Indian institutions")
        finding.risk_score += 15

    brand = _brand_lookalike(host)
    if brand:
        finding.signals.append(f"Domain closely resembles '{brand}' but is not its official site")
        finding.risk_score += 40

    if path.endswith(".apk"):
        finding.signals.append("Links directly to an Android app (.apk) install file outside the Play Store")
        finding.risk_score += 35

    if raw_url.lower().startswith("http://") and not raw_url.lower().startswith("https://"):
        finding.signals.append("Uses unencrypted HTTP, not HTTPS")
        finding.risk_score += 10

    if any(word in path or word in host for word in _CREDENTIAL_PATH_WORDS):
        finding.signals.append("URL path suggests a credential-harvesting or account-verification page")
        finding.risk_score += 20

    finding.risk_score = min(100, finding.risk_score)
    return finding


def analyze_text_urls(text: str) -> list[UrlFinding]:
    return [analyze_url(u) for u in extract_urls(text)]
