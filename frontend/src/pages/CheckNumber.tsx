import { useState, useRef, useEffect } from "react";
import Layout from "../components/Layout";
import BackHeader from "../components/BackHeader";
import { numbers, pay, users } from "../api/kavach";
import type { FraudDirectoryPreview, NumberCheckResponse, NumberVerdict } from "../api/types";
import { ShieldIcon, AlertTriangleIcon, UserIcon, PhoneIcon, MessageIcon } from "../components/Icons";

// ─────────────────────────────────────────────────────────────────
// COUNTRY DATA
// ─────────────────────────────────────────────────────────────────
const COUNTRIES = [
  { code: "+91",  flag: "", name: "India",        digits: 10, risk: "low" },
  { code: "+92",  flag: "", name: "Pakistan",     digits: 10, risk: "high" },
  { code: "+880", flag: "", name: "Bangladesh",   digits: 10, risk: "high" },
  { code: "+86",  flag: "", name: "China",        digits: 11, risk: "high" },
  { code: "+234", flag: "", name: "Nigeria",      digits: 10, risk: "high" },
  { code: "+1",   flag: "", name: "USA / Canada", digits: 10, risk: "low" },
  { code: "+44",  flag: "", name: "UK",           digits: 10, risk: "low" },
  { code: "+971", flag: "", name: "UAE",          digits: 9,  risk: "medium" },
  { code: "+966", flag: "", name: "Saudi Arabia", digits: 9,  risk: "medium" },
  { code: "+94",  flag: "", name: "Sri Lanka",    digits: 9,  risk: "medium" },
  { code: "+977", flag: "", name: "Nepal",        digits: 10, risk: "medium" },
  { code: "+95",  flag: "", name: "Myanmar",      digits: 9,  risk: "high" },
  { code: "+7",   flag: "", name: "Russia",       digits: 10, risk: "medium" },
  { code: "+60",  flag: "", name: "Malaysia",     digits: 9,  risk: "medium" },
];

// Offline-only, coarse circle hint used SOLELY when the backend is
// unreachable. This is deliberately the same "original allocation" concept
// as the backend's number_meta.py, kept tiny here since the offline path is
// a fallback of last resort, not a source of truth.
const OFFLINE_CIRCLE_HINTS: { prefix: string; circle: string }[] = [
  { prefix: "98", circle: "Delhi NCR / Maharashtra (mixed early band)" },
  { prefix: "99", circle: "Delhi NCR" },
  { prefix: "70", circle: "Maharashtra (incl. Mumbai)" },
  { prefix: "90", circle: "Uttar Pradesh" },
  { prefix: "80", circle: "Karnataka" },
];
const MNP_NOTE =
  "Since Mobile Number Portability, a number's original circle does not guarantee its current operator or the caller's location.";

function offlineCircleHint(num: string): string | null {
  return OFFLINE_CIRCLE_HINTS.find((x) => num.startsWith(x.prefix))?.circle ?? null;
}

// ─────────────────────────────────────────────────────────────────
// VERDICT CONFIG (visual design — unchanged)
// ─────────────────────────────────────────────────────────────────
type VerdictCfg = {
  icon: React.ReactNode; label: string; color: string;
  bg: string; border: string; bar: string;
  urgency: string; bgGrad: string;
};

const VERDICT_CFG: Record<NumberVerdict, VerdictCfg> = {
  verified: {
    icon: <ShieldIcon className="w-5 h-5 text-current" />, label: "Safe & Verified", color: "text-safe",
    bg: "bg-safe-bg", border: "border-safe", bar: "bg-safe",
    urgency: "none", bgGrad: "from-[#E9F5E5] to-[#f0faf0]",
  },
  reported_scam: {
    icon: <AlertTriangleIcon className="w-5 h-5 text-current" />, label: "Confirmed Scam", color: "text-highrisk",
    bg: "bg-highrisk-bg", border: "border-highrisk", bar: "bg-highrisk",
    urgency: "critical", bgGrad: "from-[#FBE9E7] to-[#fff0ef]",
  },
  high_risk_pattern: {
    icon: <AlertTriangleIcon className="w-5 h-5 text-current" />, label: "High Risk", color: "text-caution",
    bg: "bg-caution-bg", border: "border-caution", bar: "bg-caution",
    urgency: "high", bgGrad: "from-[#FDF1DC] to-[#fffbf2]",
  },
  unwanted_not_confirmed: {
    icon: <PhoneIcon className="w-5 h-5 text-current" />, label: "Spam / Unwanted", color: "text-caution",
    bg: "bg-caution-bg", border: "border-caution", bar: "bg-caution",
    urgency: "medium", bgGrad: "from-[#FDF1DC] to-[#fffbf2]",
  },
  unknown_neutral: {
    icon: <ShieldIcon className="w-5 h-5 text-current" />, label: "No Reports Found", color: "text-safe",
    bg: "bg-safe-bg", border: "border-safe", bar: "bg-safe",
    urgency: "none", bgGrad: "from-[#E9F5E5] to-[#f0faf0]",
  },
};

const URGENCY_LABEL: Record<string, { text: string; cls: string }> = {
  critical: { text: "Do NOT pick up", cls: "bg-highrisk text-white" },
  high:     { text: "Be very careful", cls: "bg-caution text-white" },
  medium:   { text: "Exercise caution", cls: "bg-caution/80 text-white" },
  low:      { text: "Proceed carefully", cls: "bg-muted text-white" },
  none:     { text: "Safe to answer", cls: "bg-safe text-white" },
};

const NUMBER_TYPE_LABEL: Record<string, string> = {
  mobile: "Mobile",
  service_1600: "Verified Service Number (1600 series)",
  promotional: "Telemarketing (140 series)",
  toll_free: "Toll-Free",
  service: "Service Number",
  unknown: "Unrecognised Format",
};

// ─────────────────────────────────────────────────────────────────
// SCAM TYPE DISPLAY META
// ─────────────────────────────────────────────────────────────────
const SCAM_META: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  digital_arrest:      { label: "Digital Arrest",       icon: <AlertTriangleIcon className="w-4 h-4 text-current"/>, cls: "bg-highrisk-bg text-highrisk" },
  kyc_fraud:            { label: "KYC Fraud",             icon: <UserIcon className="w-4 h-4 text-current"/>, cls: "bg-highrisk-bg text-highrisk" },
  investment_fraud:     { label: "Investment Scam",       icon: <AlertTriangleIcon className="w-4 h-4 text-current"/>, cls: "bg-caution-bg text-caution"  },
  delivery_customs:     { label: "Fake Courier",          icon: <AlertTriangleIcon className="w-4 h-4 text-current"/>, cls: "bg-caution-bg text-caution"  },
  bank_impersonation:   { label: "Bank Impersonation",    icon: <AlertTriangleIcon className="w-4 h-4 text-current"/>, cls: "bg-highrisk-bg text-highrisk" },
  lottery_fraud:        { label: "Lottery / Prize",       icon: <AlertTriangleIcon className="w-4 h-4 text-current"/>, cls: "bg-caution-bg text-caution"  },
  otp_theft:            { label: "OTP Theft",             icon: <AlertTriangleIcon className="w-4 h-4 text-current"/>, cls: "bg-highrisk-bg text-highrisk" },
  loan_fraud:           { label: "Loan Recovery Threats", icon: <AlertTriangleIcon className="w-4 h-4 text-current"/>, cls: "bg-caution-bg text-caution"  },
  utility_disconnection:{ label: "Utility Disconnection", icon: <AlertTriangleIcon className="w-4 h-4 text-current"/>, cls: "bg-caution-bg text-caution"  },
  task_job:             { label: "Task / Job Scam",       icon: <AlertTriangleIcon className="w-4 h-4 text-current"/>, cls: "bg-caution-bg text-caution"  },
  international_scam:   { label: "International Scam",   icon: <AlertTriangleIcon className="w-4 h-4 text-current"/>, cls: "bg-highrisk-bg text-highrisk" },
  spam:                 { label: "Spam / Marketing",      icon: <MessageIcon className="w-4 h-4 text-current"/>, cls: "bg-canvas text-muted"         },
  impersonation:        { label: "Impersonation",         icon: <UserIcon className="w-4 h-4 text-current"/>, cls: "bg-highrisk-bg text-highrisk" },
};

// ─────────────────────────────────────────────────────────────────
// OFFLINE FALLBACK — used ONLY when the backend cannot be reached.
// Deterministic, no invented report counts, clearly labeled to the user.
// ─────────────────────────────────────────────────────────────────
function offlineFallback(dialCode: string, num: string): NumberCheckResponse {
  const full = dialCode + num;
  const countryInfo = COUNTRIES.find((c) => c.code === dialCode);
  const isIndia = dialCode === "+91";
  const isHighRiskCountry = countryInfo?.risk === "high";

  if (!isIndia) {
    return {
      number: full,
      verdict: isHighRiskCountry ? "high_risk_pattern" : "unknown_neutral",
      institution: null,
      report_count: 0,
      top_categories: [],
      explanation: isHighRiskCountry
        ? `Offline estimate: this number originates from ${countryInfo?.name ?? "an unrecognised region"}. Calls from this region are frequently used in cross-border fraud targeting India. We could not reach the Kavach server to check real reports — this is a structural estimate only.`
        : `Offline estimate: we could not reach the Kavach server to check this number against real fraud reports. No structural red flags detected.`,
      tips: [
        "This result is an offline estimate, not a live database check.",
        "Never share OTPs, PINs or passwords over any call.",
        "Reconnect to the internet and re-check for an authoritative result.",
      ],
      number_type: "unknown",
      is_valid_shape: true,
      country: countryInfo?.name ?? null,
      circle: null,
      circle_note: null,
      is_verified_service: false,
      special_series: null,
      risk_score: isHighRiskCountry ? 60 : 10,
      category_breakdown: [],
    };
  }

  const circle = offlineCircleHint(num);
  return {
    number: full,
    verdict: "unknown_neutral",
    institution: null,
    report_count: 0,
    top_categories: [],
    explanation:
      "Offline estimate: we could not reach the Kavach server, so this number has NOT been checked against real fraud reports. " +
      (circle ? `Its series was originally allocated in the ${circle} circle. ${MNP_NOTE}` : "No structural red flags detected."),
    tips: [
      "This result is an offline estimate, not a live database check — reconnect and re-check when possible.",
      "Always verify the caller's identity before sharing any personal information.",
      "Never share OTPs, PINs or passwords over any call.",
    ],
    number_type: "mobile",
    is_valid_shape: true,
    country: "India",
    circle,
    circle_note: circle ? MNP_NOTE : null,
    is_verified_service: false,
    special_series: null,
    risk_score: 10,
    category_breakdown: [],
  };
}

// ─────────────────────────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────────────────────────
const HISTORY_KEY = "kavach_number_history";
type HistoryItem = { dialCode: string; number: string; verdict: NumberVerdict; ts: number };

function getHistory(): HistoryItem[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); } catch { return []; }
}
function saveHistory(item: HistoryItem) {
  const h = [item, ...getHistory().filter((x) => !(x.number === item.number && x.dialCode === item.dialCode))].slice(0, 10);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}

function splitDatasetPhone(raw: string): { dialCode: string; number: string } {
  const digits = raw.replace(/\D/g, "");
  const country = [...COUNTRIES]
    .sort((a, b) => b.code.length - a.code.length)
    .find((c) => digits.startsWith(c.code.replace("+", "")) && digits.length > c.digits);
  if (country) {
    return { dialCode: country.code, number: digits.slice(country.code.replace("+", "").length) };
  }
  return { dialCode: "+91", number: digits.slice(-10) };
}

// ─────────────────────────────────────────────────────────────────
// LOADING STEPS (animated scan phases)
// ─────────────────────────────────────────────────────────────────
const SCAN_STEPS = [
  "Checking fraud database…",
  "Analysing number series…",
  "Cross-referencing community reports…",
  "Verifying with TRAI records…",
];

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function CheckNumber() {
  const [dialCode, setDialCode] = useState("+91");
  const [number, setNumber]     = useState("");
  const [showPicker, setShowPicker]   = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  const [result, setResult]   = useState<NumberCheckResponse | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [reported, setReported] = useState(false);
  const [blocked,  setBlocked]  = useState(false);
  const [history, setHistory]   = useState<HistoryItem[]>(getHistory);
  const [directory, setDirectory] = useState<FraudDirectoryPreview | null>(null);

  const inputRef  = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const scanTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const country    = COUNTRIES.find((c) => c.code === dialCode) ?? COUNTRIES[0];
  const canCheck   = number.replace(/\D/g, "").length >= 6;
  const filteredCountries = COUNTRIES.filter(
    (c) =>
      pickerSearch === "" ||
      c.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
      c.code.includes(pickerSearch)
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
        setPickerSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    let mounted = true;
    pay.directory()
      .then((data) => { if (mounted) setDirectory(data); })
      .catch(() => { if (mounted) setDirectory(null); });
    return () => { mounted = false; };
  }, []);

  const check = async () => {
    if (!canCheck) return;
    setResult(null);
    setIsOffline(false);
    setReported(false);
    setBlocked(false);
    setLoading(true);
    setScanStep(0);

    let step = 0;
    scanTimer.current = setInterval(() => {
      step = Math.min(step + 1, SCAN_STEPS.length - 1);
      setScanStep(step);
    }, 600);

    const trimmed = number.replace(/\D/g, "");

    try {
      const res = await numbers.check(dialCode + trimmed);
      setResult(res);
      saveHistory({ dialCode, number: trimmed, verdict: res.verdict, ts: Date.now() });
      users.incrementScore(5).catch(console.error);
    } catch {
      const res = offlineFallback(dialCode, trimmed);
      setResult(res);
      setIsOffline(true);
      saveHistory({ dialCode, number: trimmed, verdict: res.verdict, ts: Date.now() });
    } finally {
      if (scanTimer.current) clearInterval(scanTimer.current);
      setLoading(false);
      setHistory(getHistory());
    }
  };

  const doReport = async () => {
    if (!result) return;
    try { await numbers.report(result.number, "scam"); } catch {}
    setReported(true);
  };

  const resetCheck = () => {
    setResult(null);
    setIsOffline(false);
    setNumber("");
    setReported(false);
    setBlocked(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const cfg = result ? VERDICT_CFG[result.verdict] : null;
  const urgencyInfo = cfg ? URGENCY_LABEL[cfg.urgency] : null;

  const displayNumber = number.replace(/\D/g, "").replace(/(\d{5})(\d{5})/, "$1 $2");

  return (
    <Layout>
      <BackHeader
        title="Number Checker"
        subtitle="Powered by Kavach community database"
      />

      {/* ── INPUT CARD ── */}
      <div className="card mb-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          Enter Phone Number
        </p>

        <div className="flex gap-2">
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => { setShowPicker((v) => !v); setPickerSearch(""); }}
              className={`flex h-12 min-w-[80px] items-center gap-1.5 rounded-card border px-3 text-sm font-medium transition ${
                showPicker ? "border-saffron bg-canvas" : "border-hairline bg-canvas hover:border-saffron"
              } ${country.risk === "high" ? "border-l-4 border-l-highrisk" : ""}`}
            >
              <span className="text-xl leading-none">{country.flag}</span>
              <span className="font-bold text-navy">{country.code}</span>
              <svg className={`h-3 w-3 text-muted transition-transform ${showPicker ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showPicker && (
              <div className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-card border border-hairline bg-surface shadow-2xl">
                <div className="border-b border-hairline px-3 py-2">
                  <input
                    autoFocus
                    className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
                    placeholder="Search country…"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {filteredCountries.map((c) => (
                    <button
                      key={c.code}
                      className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition hover:bg-canvas ${
                        c.code === dialCode ? "bg-canvas" : ""
                      }`}
                      onClick={() => { setDialCode(c.code); setShowPicker(false); setPickerSearch(""); inputRef.current?.focus(); }}
                    >
                      <span className="text-base">{c.flag}</span>
                      <span className={`flex-1 font-medium ${c.code === dialCode ? "text-navy" : "text-ink"}`}>
                        {c.name}
                      </span>
                      <span className="text-xs text-muted">{c.code}</span>
                      {c.risk === "high" && (
                        <span className="rounded-full bg-highrisk/10 px-1.5 py-0.5 text-[9px] font-bold text-highrisk">HIGH RISK</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <input
            ref={inputRef}
            className="input flex-1 font-medium tracking-wide"
            inputMode="numeric"
            placeholder={`${country.digits}-digit number`}
            maxLength={country.digits + 3}
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/[^\d\s]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && check()}
          />
        </div>

        {country.risk === "high" && (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-highrisk/8 px-3 py-1.5">
            <span className="text-sm"></span>
            <p className="text-xs font-medium text-highrisk">
              {country.name} numbers are frequently used in cross-border fraud targeting India
            </p>
          </div>
        )}

        <button
          className="btn-primary mt-3 flex items-center justify-center gap-2"
          disabled={loading || !canCheck}
          onClick={check}
        >
          {loading ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              {SCAN_STEPS[scanStep]}
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <circle cx="11" cy="11" r="6" />
                <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
              </svg>
              Check This Number
            </>
          )}
        </button>
      </div>

      {/* ── LOADING SKELETON ── */}
      {loading && (
        <div className="mb-4 animate-pulse space-y-3 rounded-card border border-hairline bg-surface p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-hairline" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-3/4 rounded bg-hairline" />
              <div className="h-3 w-1/2 rounded bg-hairline" />
            </div>
          </div>
          <div className="h-2.5 w-full rounded-full bg-hairline" />
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-hairline" />
            <div className="h-3 w-5/6 rounded bg-hairline" />
          </div>
        </div>
      )}

      {/* ── OFFLINE NOTICE ── */}
      {result && isOffline && !loading && (
        <div className="mb-3 flex items-center gap-2 rounded-card border border-caution/40 bg-caution-bg px-3 py-2">
          <span className="text-sm"></span>
          <p className="text-xs font-medium text-caution">
            Offline estimate — could not reach the Kavach server. This is not a live database check.
          </p>
        </div>
      )}

      {/* ── RESULT CARD ── */}
      {result && cfg && !loading && (
        <div className="mb-4 overflow-hidden rounded-card border border-hairline shadow-sm">
          <div className={`bg-gradient-to-br ${cfg.bgGrad} px-4 pt-4 pb-4`}>
            <div className="flex items-start gap-3">
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 ${cfg.border} ${cfg.bg} text-2xl`}>
                {cfg.urgency === "critical" ? "" : cfg.urgency === "high" ? "" : cfg.icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-base font-bold ${cfg.color}`}>{cfg.label}</p>
                  {urgencyInfo && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${urgencyInfo.cls}`}>
                      {urgencyInfo.text}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-ink mt-0.5">
                  {dialCode} {displayNumber || number}
                </p>
                <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                  {result.circle && (
                    <span className="text-xs text-muted">{result.circle} (original allocation)</span>
                  )}
                  {!result.circle && result.country && (
                    <span className="text-xs text-muted">{result.country}</span>
                  )}
                  {result.number_type && NUMBER_TYPE_LABEL[result.number_type] && (
                    <>
                      <span className="text-xs text-muted">·</span>
                      <span className="text-xs text-muted">{NUMBER_TYPE_LABEL[result.number_type]}</span>
                    </>
                  )}
                </div>
                {result.circle_note && (
                  <p className="mt-1 text-[10px] leading-snug text-muted italic"> {result.circle_note}</p>
                )}
              </div>

              {result.report_count > 0 && (
                <div className={`shrink-0 rounded-xl ${cfg.bg} border ${cfg.border} px-3 py-1.5 text-center`}>
                  <p className={`text-lg font-black ${cfg.color} leading-tight`}>{result.report_count}</p>
                  <p className={`text-[9px] font-bold uppercase tracking-wide ${cfg.color}`}>Reports</p>
                </div>
              )}
            </div>

            {/* Risk meter — driven directly by the backend's deterministic risk_score */}
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted uppercase tracking-wide">Risk Score</span>
                <span className={`text-sm font-black ${cfg.color}`}>{result.risk_score} / 100</span>
              </div>
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-hairline">
                <div
                  className={`absolute left-0 top-0 h-full rounded-full ${cfg.bar} transition-all duration-1000`}
                  style={{ width: `${result.risk_score}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[9px] font-semibold text-muted uppercase">
                <span>Safe</span><span>Caution</span><span>High Risk</span>
              </div>
            </div>
          </div>

          {/* ── Explanation ── */}
          <div className="border-t border-hairline bg-surface px-4 py-3">
            <p className="text-sm leading-relaxed text-ink">{result.explanation}</p>
          </div>

          {/* ── Scam types ── */}
          {result.top_categories.length > 0 && (
            <div className="border-t border-hairline bg-canvas px-4 py-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">
                Reported For
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.top_categories.map((cat) => {
                  const m = SCAM_META[cat] ?? { label: cat, icon: <AlertTriangleIcon className="w-4 h-4 text-current"/>, cls: "bg-canvas text-muted" };
                  return (
                    <span key={cat} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${m.cls}`}>
                      {m.icon} {m.label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Community breakdown bar — real category_breakdown from the backend ── */}
          {result.category_breakdown.length > 0 && (
            <div className="border-t border-hairline bg-surface px-4 py-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">
                Community Reports Breakdown
              </p>
              <div className="space-y-2">
                {result.category_breakdown.map(({ category, label, pct }) => {
                  const m = SCAM_META[category] ?? { label, icon: <AlertTriangleIcon className="w-4 h-4 text-current"/>, cls: "bg-caution text-caution" };
                  return (
                    <div key={category}>
                      <div className="mb-0.5 flex justify-between text-xs">
                        <span className="font-medium text-ink">{m.icon} {label}</span>
                        <span className="font-semibold text-muted">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-hairline">
                        <div
                          className="h-full rounded-full bg-caution transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── What to do ── */}
          <div className={`border-t border-hairline px-4 py-3 ${cfg.bg}`}>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">What to do</p>
            <ul className="space-y-2">
              {result.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink">
                  <span className={`mt-0.5 shrink-0 text-base font-bold ${cfg.color}`}>›</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* ── Action buttons ── */}
          <div className="border-t border-hairline bg-surface">
            <div className="grid grid-cols-3 divide-x divide-hairline">
              <button
                onClick={doReport}
                disabled={reported}
                className={`flex flex-col items-center gap-1 py-3 text-center transition ${
                  reported ? "opacity-50" : "hover:bg-canvas"
                }`}
              >
                <span className="text-lg">{reported ? "" : ""}</span>
                <span className="text-[10px] font-semibold text-muted">
                  {reported ? "Reported" : "Report"}
                </span>
              </button>

              <button
                onClick={() => setBlocked((v) => !v)}
                className="flex flex-col items-center gap-1 py-3 text-center transition hover:bg-canvas"
              >
                <span className="text-lg">{blocked ? "" : ""}</span>
                <span className={`text-[10px] font-semibold ${blocked ? "text-safe" : "text-muted"}`}>
                  {blocked ? "Unblock" : "Block"}
                </span>
              </button>

              <a
                href={`tel:${dialCode}${number.replace(/\D/g, "")}`}
                className="flex flex-col items-center gap-1 py-3 text-center transition hover:bg-canvas"
              >
                <span className="text-lg"></span>
                <span className="text-[10px] font-semibold text-muted">Call</span>
              </a>
            </div>

            {cfg.urgency !== "none" && (
              <div className="border-t border-hairline px-4 py-3">
                <a
                  href="https://cybercrime.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-card bg-highrisk/8 py-2.5 text-sm font-semibold text-highrisk transition hover:bg-highrisk/15"
                >
                   Report to National Cyber Crime Portal
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CHECK ANOTHER NUMBER ── */}
      {result && !loading && (
        <button
          onClick={resetCheck}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-card border-2 border-dashed border-saffron/50 bg-canvas py-3.5 text-sm font-semibold text-navy transition hover:border-saffron hover:bg-saffron/5 active:scale-[0.98]"
        >
          <svg className="h-4 w-4 text-saffron" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <circle cx="11" cy="11" r="6" />
            <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
          </svg>
          Check Another Number
        </button>
      )}

      {/* ── RECENT SEARCHES ── */}
      {history.length > 0 && !result && !loading && (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Recent Checks</p>
            <button
              className="text-xs text-muted underline"
              onClick={() => { localStorage.removeItem(HISTORY_KEY); setHistory([]); }}
            >
              Clear
            </button>
          </div>
          <div className="space-y-2">
            {history.map((h) => {
              const c = VERDICT_CFG[h.verdict];
              const flag = COUNTRIES.find((x) => x.code === h.dialCode)?.flag ?? "";
              return (
                <button
                  key={h.number + h.ts}
                  className="flex w-full items-center gap-3 rounded-card border border-hairline bg-surface px-4 py-3 text-left transition hover:bg-canvas active:scale-[0.99]"
                  onClick={() => { setDialCode(h.dialCode); setNumber(h.number); }}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${c.bg}`}>
                    {flag}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {h.dialCode} {h.number.replace(/(\d{5})(\d{5})/, "$1 $2")}
                    </p>
                    <p className={`text-xs font-medium ${c.color}`}>
                      {c.icon} {c.label}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted">
                      {new Date(h.ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                    <svg className="ml-auto mt-1 h-3 w-3 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── KNOWN FRAUD NUMBERS ── */}
      {!result && !loading && directory && (
        <div className="mb-4 rounded-card border border-highrisk/20 bg-highrisk/5 px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-highrisk">Known Fraud Numbers</p>
              <p className="mt-0.5 text-xs text-muted">Loaded from your fraud phone dataset.</p>
            </div>
            <span className="rounded-full border border-highrisk/20 bg-highrisk/10 px-2 py-1 text-[10px] font-bold text-highrisk">
              {directory.counts.phone.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {directory.samples.phone.slice(0, 6).map((phone) => (
              <button
                key={phone}
                type="button"
                onClick={() => {
                  const parsed = splitDatasetPhone(phone);
                  setDialCode(parsed.dialCode);
                  setNumber(parsed.number);
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
                className="rounded-md border border-highrisk/15 bg-surface px-3 py-2 text-left"
              >
                <p className="truncate text-sm font-bold text-ink">{phone}</p>
                <p className="text-[10px] font-bold uppercase text-highrisk">Fraud dataset</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── HOW IT WORKS ── */}
      {!result && !loading && (
        <div className="rounded-card border border-hairline bg-canvas px-4 py-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted"> How Kavach Checks Numbers</p>
          <div className="space-y-2">
            {[
              { icon: "", text: "Cross-checks against our crowd-sourced fraud database of reported numbers" },
              { icon: "", text: "Flags international numbers from Pakistan, Bangladesh, Nigeria & other high-risk origins" },
              { icon: "", text: "Recognises TRAI number series — 140 (telemarketing) and 1600/1601 (verified bank/government)" },
              { icon: "", text: "Shows the original telecom circle a number's series was allocated to (not the current operator — see MNP note)" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-sm">{item.icon}</span>
                <p className="text-xs leading-relaxed text-muted">{item.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-hairline pt-2.5">
            <p className="text-xs text-muted">
              To report a fraud call, call <span className="font-semibold text-navy">1930</span> (National Cyber Crime Helpline) or visit{" "}
              <span className="font-semibold text-navy">cybercrime.gov.in</span>
            </p>
          </div>
        </div>
      )}
    </Layout>
  );
}
