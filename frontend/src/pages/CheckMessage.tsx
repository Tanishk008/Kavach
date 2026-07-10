import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { messages } from "../api/kavach";
import type { ClassifyResponse, Tier } from "../api/types";

// ─────────────────────────────────────────────────────────────────
// VERDICT CONFIG
// ─────────────────────────────────────────────────────────────────
type VerdictCfg = {
  icon: string; label: string; color: string;
  bg: string; border: string; bar: string;
  urgency: string; bgGrad: string;
};

const VERDICT_CFG: Record<Tier, VerdictCfg> = {
  safe: {
    icon: "✅", label: "Safe Message", color: "text-safe",
    bg: "bg-safe-bg", border: "border-safe", bar: "bg-safe",
    urgency: "none", bgGrad: "from-[#E9F5E5] to-[#f0faf0]",
  },
  caution: {
    icon: "⚠️", label: "Suspicious", color: "text-caution",
    bg: "bg-caution-bg", border: "border-caution", bar: "bg-caution",
    urgency: "medium", bgGrad: "from-[#FDF1DC] to-[#fffbf2]",
  },
  high_risk: {
    icon: "🚨", label: "Confirmed Scam", color: "text-highrisk",
    bg: "bg-highrisk-bg", border: "border-highrisk", bar: "bg-highrisk",
    urgency: "critical", bgGrad: "from-[#FBE9E7] to-[#fff0ef]",
  },
};

const URGENCY_LABEL: Record<string, { text: string; cls: string }> = {
  critical: { text: "Do NOT click links", cls: "bg-highrisk text-white" },
  high:     { text: "Be very careful", cls: "bg-caution text-white" },
  medium:   { text: "Exercise caution", cls: "bg-caution/80 text-white" },
  low:      { text: "Proceed carefully", cls: "bg-muted text-white" },
  none:     { text: "Appears Safe", cls: "bg-safe text-white" },
};

// Human-readable labels for the backend's scam_type keys — mirrors
// backend/app/core/number_meta.py CATEGORY_LABELS plus the message-only
// violent_threat category.
const SCAM_TYPE_LABEL: Record<string, string> = {
  digital_arrest: "Digital Arrest Scam",
  kyc_fraud: "KYC Fraud",
  bank_impersonation: "Bank Impersonation",
  loan_fraud: "Loan Recovery Threats",
  investment_fraud: "Investment Scam",
  delivery_customs: "Fake Courier / Customs",
  sextortion: "Sextortion",
  otp_theft: "OTP Theft",
  lottery_fraud: "Lottery / Prize Scam",
  utility_disconnection: "Utility Disconnection Threat",
  task_job: "Task / Job Scam",
  international_scam: "International Scam",
  impersonation: "Impersonation",
  spam: "Spam / Marketing",
  violent_threat: "Violent Threat / Abuse",
  other: "Suspicious Message",
};

// ─────────────────────────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────────────────────────
const HISTORY_KEY = "kavach_msg_history";
type HistoryItem = { text: string; tier: Tier; ts: number };

function getHistory(): HistoryItem[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); } catch { return []; }
}
function saveHistory(item: HistoryItem) {
  const h = [item, ...getHistory().filter((x) => x.text !== item.text)].slice(0, 10);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}

// ─────────────────────────────────────────────────────────────────
// LOADING STEPS
// ─────────────────────────────────────────────────────────────────
const SCAN_STEPS = [
  "Scanning text for threats…",
  "Analysing embedded links…",
  "Checking urgency keywords…",
  "Cross-referencing database…",
];

// ─────────────────────────────────────────────────────────────────
// OFFLINE FALLBACK — used ONLY when the backend cannot be reached.
// A thin, honestly-labeled placeholder, not a second classifier.
// ─────────────────────────────────────────────────────────────────
function offlineFallback(): ClassifyResponse {
  return {
    tier: "caution",
    confidence: 0.4,
    scam_type: null,
    reasons: [
      "Could not reach the Kavach server to run the full classifier.",
      "This message has NOT been checked against the real scam-detection engine.",
    ],
    playbook: {
      id: "pb_offline",
      title: "While offline",
      steps: [
        { order: 1, text: "Do not click any links or share OTPs/PINs until you can re-check this message online." },
        { order: 2, text: "Reconnect to the internet and scan again for an authoritative result." },
        { order: 3, text: "When in doubt, verify directly with the institution using an official number, not one in the message." },
      ],
    },
    voice_signal: null,
    event_id: null,
    risk_score: 40,
    extracted: { urls: [], keywords: [], phone_numbers: [] },
  };
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function CheckMessage() {
  const navigate = useNavigate();
  const [text, setText] = useState("");

  const [result, setResult] = useState<ClassifyResponse | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>(getHistory);
  const [reported, setReported] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scanTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const canCheck = text.trim().length > 5;

  const check = async () => {
    if (!canCheck) return;
    setResult(null);
    setIsOffline(false);
    setReported(false);
    setLoading(true);
    setScanStep(0);

    let step = 0;
    scanTimer.current = setInterval(() => {
      step = Math.min(step + 1, SCAN_STEPS.length - 1);
      setScanStep(step);
    }, 600);

    const input = text.trim();

    try {
      const res = await messages.classify(input);
      setResult(res);
      saveHistory({ text: input, tier: res.tier, ts: Date.now() });
    } catch {
      const res = offlineFallback();
      setResult(res);
      setIsOffline(true);
      saveHistory({ text: input, tier: res.tier, ts: Date.now() });
    } finally {
      if (scanTimer.current) clearInterval(scanTimer.current);
      setLoading(false);
      setHistory(getHistory());
    }
  };

  const resetCheck = () => {
    setResult(null);
    setIsOffline(false);
    setText("");
    setReported(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const cfg = result ? VERDICT_CFG[result.tier] : null;
  const urgencyInfo = cfg ? URGENCY_LABEL[cfg.urgency] : null;
  const scamLabel = result?.scam_type ? SCAM_TYPE_LABEL[result.scam_type] ?? result.scam_type : null;

  return (
    <Layout>
      {/* ── Header ── */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-surface text-muted transition hover:bg-canvas"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-ink">Message Scanner</h1>
          <p className="text-xs text-muted">Detect phishing links and scam texts</p>
        </div>
      </div>

      {/* ── Input card ── */}
      <div className="card mb-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          Paste Suspicious Message
        </p>

        <textarea
          ref={inputRef}
          className="input min-h-[120px] w-full resize-none text-sm leading-relaxed"
          placeholder="e.g., 'Dear customer, your electricity will be disconnected tonight at 9:30 PM. Call officer on 9876543210'"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) check();
          }}
        />

        <button
          className="btn-primary mt-3 flex w-full items-center justify-center gap-2"
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
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Scan Message
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
        </div>
      )}

      {/* ── OFFLINE NOTICE ── */}
      {result && isOffline && !loading && (
        <div className="mb-3 flex items-center gap-2 rounded-card border border-caution/40 bg-caution-bg px-3 py-2">
          <span className="text-sm">📡</span>
          <p className="text-xs font-medium text-caution">
            Offline estimate — could not reach the Kavach server. This message has not been fully classified.
          </p>
        </div>
      )}

      {/* ── RESULT CARD ── */}
      {result && cfg && !loading && (
        <div className="mb-4 overflow-hidden rounded-card border border-hairline shadow-sm">
          {/* Gradient header */}
          <div className={`bg-gradient-to-br ${cfg.bgGrad} px-4 pt-4 pb-4`}>
            <div className="flex items-start gap-3">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 ${cfg.border} ${cfg.bg} text-2xl`}>
                {cfg.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-base font-bold ${cfg.color}`}>{cfg.label}</p>
                  {urgencyInfo && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${urgencyInfo.cls}`}>
                      {urgencyInfo.text}
                    </span>
                  )}
                </div>
                {scamLabel && (
                  <p className="mt-0.5 text-sm font-semibold text-ink">
                    Type: {scamLabel}
                  </p>
                )}
                <span className="mt-1 inline-block text-xs text-muted">
                  Confidence: {Math.round(result.confidence * 100)}%
                </span>
              </div>
            </div>

            {/* Risk meter — driven directly by the backend's deterministic risk_score */}
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted uppercase tracking-wide">Threat Level</span>
                <span className={`text-sm font-black ${cfg.color}`}>{result.risk_score} / 100</span>
              </div>
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-hairline">
                <div
                  className={`absolute left-0 top-0 h-full rounded-full ${cfg.bar} transition-all duration-1000`}
                  style={{ width: `${result.risk_score}%` }}
                />
              </div>
            </div>
          </div>

          {/* ── AI Analysis ── */}
          <div className="border-t border-hairline bg-surface px-4 py-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">Analysis</p>
            <ul className="space-y-1.5">
              {result.reasons.map((reason, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink">
                  <span className={`mt-0.5 shrink-0 font-bold ${cfg.color}`}>•</span>
                  {reason}
                </li>
              ))}
            </ul>
          </div>

          {/* ── Extracted Elements — real backend URL/keyword analysis ── */}
          {(result.extracted.urls.length > 0 || result.extracted.keywords.length > 0) && (
            <div className="border-t border-hairline bg-canvas px-4 py-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">Detected Flags</p>

              {result.extracted.urls.length > 0 && (
                <div className="mb-2 space-y-1.5">
                  <p className="text-xs text-muted mb-1">Links Found:</p>
                  {result.extracted.urls.map((u, i) => {
                    const risky = u.risk_score >= 25;
                    return (
                      <div
                        key={i}
                        className={`rounded-md border px-2 py-1.5 text-xs ${
                          risky
                            ? "border-highrisk/20 bg-highrisk/10 text-highrisk"
                            : "border-hairline bg-surface text-muted"
                        }`}
                      >
                        <p className="font-medium break-all">
                          {risky ? "🔗" : "🔎"} {u.url} <span className="font-bold">({u.risk_score}/100)</span>
                        </p>
                        {u.signals.length > 0 && (
                          <ul className="mt-1 space-y-0.5 pl-3">
                            {u.signals.map((s, j) => (
                              <li key={j} className="list-disc leading-snug">{s}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {result.extracted.keywords.length > 0 && (
                <div>
                  <p className="text-xs text-muted mb-1">Urgency / Scam Keywords:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.extracted.keywords.map((kw, i) => (
                      <span key={i} className="rounded-md bg-caution/15 px-2 py-1 text-xs font-medium text-caution border border-caution/20">
                        ⚠️ "{kw}"
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Playbook / Tips ── */}
          {result.playbook && (
            <div className={`border-t border-hairline px-4 py-3 ${cfg.bg}`}>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">{result.playbook.title}</p>
              <ul className="space-y-2">
                {result.playbook.steps.map((step) => (
                  <li key={step.order} className="flex items-start gap-2 text-sm text-ink">
                    <span className={`mt-0.5 shrink-0 text-base font-bold ${cfg.color}`}>›</span>
                    {step.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Actions ── */}
          <div className="border-t border-hairline bg-surface">
            {cfg.urgency !== "none" && (
              <div className="px-4 py-3 flex gap-2">
                <button
                  onClick={() => setReported(true)}
                  disabled={reported}
                  className="flex-1 rounded-card border border-highrisk/40 bg-highrisk-bg py-2.5 text-sm font-semibold text-highrisk transition hover:bg-highrisk/15 disabled:opacity-50"
                >
                  {reported ? "✓ Reported" : "🚩 Report Scam"}
                </button>
              </div>
            )}

            {cfg.urgency !== "none" && (
              <div className="border-t border-hairline px-4 py-3">
                <a
                  href="https://cybercrime.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-card bg-highrisk/8 py-2.5 text-sm font-semibold text-highrisk transition hover:bg-highrisk/15"
                >
                  🛡️ Report to National Cyber Crime Portal
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CHECK ANOTHER ── */}
      {result && !loading && (
        <button
          onClick={resetCheck}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-card border-2 border-dashed border-saffron/50 bg-canvas py-3.5 text-sm font-semibold text-navy transition hover:border-saffron hover:bg-saffron/5"
        >
          <svg className="h-4 w-4 text-saffron" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          Check Another Message
        </button>
      )}

      {/* ── RECENT SEARCHES ── */}
      {history.length > 0 && !result && !loading && (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Recent Scans</p>
            <button
              className="text-xs text-muted underline"
              onClick={() => { localStorage.removeItem(HISTORY_KEY); setHistory([]); }}
            >
              Clear
            </button>
          </div>
          <div className="space-y-2">
            {history.map((h, i) => {
              const c = VERDICT_CFG[h.tier] ?? VERDICT_CFG.safe;
              return (
                <button
                  key={i}
                  className="flex w-full items-center gap-3 rounded-card border border-hairline bg-surface px-4 py-3 text-left transition hover:bg-canvas"
                  onClick={() => setText(h.text)}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${c.bg}`}>
                    {c.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      "{h.text}"
                    </p>
                    <p className={`text-xs font-semibold ${c.color}`}>
                      {c.label}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── HOW IT WORKS ── */}
      {!result && !loading && (
        <div className="rounded-card border border-hairline bg-canvas px-4 py-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">⚡ How Kavach Scans</p>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-sm">🔗</span>
              <p className="text-xs leading-relaxed text-muted">Analyses every link for shorteners, raw IPs, punycode, lookalike domains, and .apk downloads</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sm">⚠️</span>
              <p className="text-xs leading-relaxed text-muted">Scores urgency and threat keywords across 12+ known scam categories</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sm">🧠</span>
              <p className="text-xs leading-relaxed text-muted">Recognises genuine bank/NBFC transaction alerts so real SMS aren't flagged</p>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
