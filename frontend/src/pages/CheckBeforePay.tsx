import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import BackHeader from "../components/BackHeader";
import { numbers, pay } from "../api/kavach";
import type { FraudDirectoryPreview, PayCheckResponse } from "../api/types";

type VerdictType = "safe" | "suspicious" | "flagged";
type IdentifierType = PayCheckResponse["identifier_type"];

const VERDICT_CFG: Record<VerdictType, { label: string; icon: string; bg: string; border: string; color: string; bar: string }> = {
  safe: { label: "No fraud signal found", icon: "OK", bg: "bg-safe-bg", border: "border-safe", color: "text-safe", bar: "bg-safe" },
  suspicious: { label: "Suspicious pattern", icon: "!", bg: "bg-caution-bg", border: "border-caution", color: "text-caution", bar: "bg-caution" },
  flagged: { label: "Flagged in fraud directory", icon: "!!", bg: "bg-highrisk-bg", border: "border-highrisk", color: "text-highrisk", bar: "bg-highrisk" },
};

const TYPE_META: Record<IdentifierType, { label: string; hint: string; icon: string; placeholder: string }> = {
  upi: {
    label: "UPI ID",
    hint: "Checks VPA handle, suspicious words, community reports, and raw fraud UPI samples.",
    icon: "UPI",
    placeholder: "name@okaxis or shop@paytm",
  },
  phone: {
    label: "Phone number",
    hint: "Checks fraud reports and known scam caller numbers before you respond or pay.",
    icon: "TEL",
    placeholder: "+91 98765 43210",
  },
  account: {
    label: "Bank account",
    hint: "Checks beneficiary account numbers against reported fraud-directory entries.",
    icon: "A/C",
    placeholder: "12 to 18 digit account number",
  },
  unknown: {
    label: "Any identifier",
    hint: "Paste a UPI ID, phone number, or bank account number.",
    icon: "ID",
    placeholder: "UPI, phone, or bank account",
  },
};

const HISTORY_KEY = "kavach_fraud_directory_history";
type HistoryItem = { identifier: string; verdict: VerdictType; type: IdentifierType; ts: number };

function getHistory(): HistoryItem[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); } catch { return []; }
}

function saveHistory(item: HistoryItem) {
  const h = [item, ...getHistory().filter((x) => x.identifier !== item.identifier)].slice(0, 10);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}

function detectType(value: string): IdentifierType {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.includes("@")) return "upi";
  if (digits.length >= 10 && digits.length <= 13 && (trimmed.startsWith("+") || digits.length === 10)) return "phone";
  if (digits.length >= 9 && digits.length <= 18) return "account";
  return "unknown";
}

function normalizeInput(value: string, type: IdentifierType) {
  if (type === "upi") return value.toLowerCase().replace(/\s/g, "");
  if (type === "phone" || type === "account") return value.replace(/[^\d+]/g, "");
  return value;
}

const SCAN_STEPS = [
  "Identifying payment detail...",
  "Checking fraud directory...",
  "Reviewing community reports...",
  "Preparing emergency actions...",
];

export default function CheckBeforePay() {
  const [identifier, setIdentifier] = useState("");
  const [result, setResult] = useState<PayCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [error, setError] = useState("");
  const [reported, setReported] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>(getHistory);
  const [directory, setDirectory] = useState<FraudDirectoryPreview | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const inputType = detectType(identifier);
  const meta = TYPE_META[inputType];
  const canCheck = identifier.trim().length >= 4;

  useEffect(() => {
    let mounted = true;
    pay.directory()
      .then((data) => { if (mounted) setDirectory(data); })
      .catch(() => { if (mounted) setDirectory(null); });
    return () => { mounted = false; };
  }, []);

  const check = async () => {
    if (!canCheck) return;
    setError("");
    setReported(false);
    setResult(null);
    setLoading(true);
    setScanStep(0);
    let step = 0;
    timerRef.current = setInterval(() => {
      step = Math.min(step + 1, SCAN_STEPS.length - 1);
      setScanStep(step);
    }, 650);
    try {
      const res = await pay.check(identifier.trim());
      setResult(res);
      const verdict = (["safe", "suspicious", "flagged"].includes(res.verdict) ? res.verdict : "safe") as VerdictType;
      saveHistory({ identifier: res.identifier, verdict, type: res.identifier_type, ts: Date.now() });
      setHistory(getHistory());
    } catch (e) {
      setError((e as Error).message || "Could not reach the Kavach server. Please try again.");
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setLoading(false);
    }
  };

  const doReport = async () => {
    const value = result?.identifier ?? identifier.trim();
    const type = result?.identifier_type ?? inputType;
    if (!value) return;
    try { await numbers.report(value, type === "upi" ? "upi_fraud" : "payment_fraud", type === "unknown" ? "account" : type); } catch {}
    setReported(true);
  };

  const reset = () => {
    setIdentifier("");
    setResult(null);
    setError("");
    setReported(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const verdict = (result?.verdict ?? "safe") as VerdictType;
  const cfg = VERDICT_CFG[verdict] ?? VERDICT_CFG.safe;
  const resultMeta = result ? TYPE_META[result.identifier_type] : meta;

  return (
    <Layout>
      <BackHeader
        title="Fraud Directory"
        subtitle="Check UPI IDs, phone numbers, and bank accounts before paying"
        badge={<span className="rounded-full border border-saffron/20 bg-saffron/10 px-2 py-0.5 text-[10px] font-bold text-saffron">PAY SAFE</span>}
      />

      <div className="mb-3 grid grid-cols-3 gap-2">
        {(["upi", "phone", "account"] as IdentifierType[]).map((type) => (
          <button
            key={type}
            type="button"
            className={`rounded-card border px-2 py-2 text-left transition ${inputType === type ? "border-saffron bg-canvas" : "border-hairline bg-surface"}`}
            onClick={() => {
              setIdentifier("");
              setResult(null);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
          >
            <p className="text-[10px] font-black text-navy">{TYPE_META[type].icon}</p>
            <p className="mt-1 text-xs font-semibold text-ink">{TYPE_META[type].label}</p>
          </button>
        ))}
      </div>

      <div className="card mb-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">Search payment detail</p>
            <p className="mt-1 text-xs text-muted">{meta.hint}</p>
          </div>
          <span className="shrink-0 rounded-md border border-hairline bg-canvas px-2 py-1 text-[10px] font-bold text-navy">{meta.label}</span>
        </div>

        <input
          ref={inputRef}
          className="input font-medium"
          placeholder={meta.placeholder}
          value={identifier}
          onChange={(e) => setIdentifier(normalizeInput(e.target.value, detectType(e.target.value)))}
          onKeyDown={(e) => e.key === "Enter" && check()}
        />

        <button className="btn-primary mt-3" disabled={loading || !canCheck} onClick={check}>
          {loading ? SCAN_STEPS[scanStep] : "Check Fraud Directory"}
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-card border border-caution/40 bg-caution-bg px-3 py-2">
          <p className="text-xs font-medium text-caution">{error}</p>
        </div>
      )}

      {!result && !loading && directory && (
        <div className="mb-4 rounded-card border border-hairline bg-surface px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted">Known fraud entries</p>
              <p className="mt-0.5 text-xs text-muted">Loaded from your CSV datasets in the database folder.</p>
            </div>
            <span className="rounded-full border border-highrisk/20 bg-highrisk/10 px-2 py-1 text-[10px] font-bold text-highrisk">
              {(directory.counts.upi + directory.counts.phone + directory.counts.account).toLocaleString("en-IN")}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["upi", "phone", "account"] as const).map((type) => (
              <div key={type} className="rounded-md border border-hairline bg-canvas px-2 py-2">
                <p className="text-[10px] font-black text-navy">{TYPE_META[type].label}</p>
                <p className="text-sm font-bold text-ink">{directory.counts[type].toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1.5">
            {(directory.samples[inputType === "unknown" ? "upi" : inputType] ?? []).slice(0, 4).map((record) => (
              <button
                key={record}
                type="button"
                onClick={() => setIdentifier(record)}
                className="flex w-full items-center justify-between rounded-md border border-highrisk/15 bg-highrisk/5 px-3 py-2 text-left"
              >
                <code className="truncate text-xs font-semibold text-ink">{record}</code>
                <span className="ml-2 shrink-0 text-[10px] font-bold uppercase text-highrisk">Fraud</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {result && !loading && (
        <div className={`mb-4 overflow-hidden rounded-card border ${cfg.border} bg-surface shadow-sm`}>
          <div className={`${cfg.bg} px-4 py-4`}>
            <div className="flex items-start gap-3">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${cfg.border} bg-white text-sm font-black ${cfg.color}`}>
                {cfg.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-base font-bold ${cfg.color}`}>{cfg.label}</p>
                <p className="mt-0.5 break-all text-sm font-semibold text-ink">{result.identifier}</p>
                <p className="mt-1 text-xs text-muted">{resultMeta.label} check</p>
              </div>
              <div className={`rounded-lg border ${cfg.border} bg-white px-3 py-1.5 text-center`}>
                <p className={`text-lg font-black leading-none ${cfg.color}`}>{result.risk_score}</p>
                <p className="mt-0.5 text-[9px] font-bold uppercase text-muted">Risk</p>
              </div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/70">
              <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${Math.max(4, result.risk_score)}%` }} />
            </div>
          </div>

          <div className="border-t border-hairline px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Assessment</p>
            <p className="mt-1 text-sm leading-relaxed text-ink">{result.explanation}</p>
          </div>

          <div className="border-t border-hairline bg-canvas px-4 py-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">Source checks</p>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${result.dataset_flagged ? "border-highrisk/30 bg-highrisk/10 text-highrisk" : "border-safe/30 bg-safe-bg text-safe"}`}>
                {result.dataset_flagged ? "Directory match" : "No directory match"}
              </span>
              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${result.report_count > 0 ? "border-highrisk/30 bg-highrisk/10 text-highrisk" : "border-safe/30 bg-safe-bg text-safe"}`}>
                {result.report_count} community reports
              </span>
              {result.upi_handle_trust && (
                <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${result.upi_handle_trust === "verified" ? "border-safe/30 bg-safe-bg text-safe" : "border-caution/30 bg-caution-bg text-caution"}`}>
                  {result.upi_institution ?? "Unknown UPI handle"}
                </span>
              )}
            </div>
          </div>

          {result.pattern_signals.length > 0 && (
            <div className="border-t border-hairline px-4 py-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">Pattern flags</p>
              <div className="flex flex-wrap gap-1.5">
                {result.pattern_signals.map((signal) => (
                  <span key={signal} className="rounded-md border border-caution/20 bg-caution/15 px-2 py-1 text-xs font-semibold text-caution">{signal}</span>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-hairline bg-surface px-4 py-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">Emergency fraud contacts</p>
            <div className="space-y-2">
              {result.emergency_contacts.map((contact) => (
                contact.action ? (
                  <a key={contact.label} href={contact.action} target={contact.action.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="flex items-center justify-between rounded-md border border-hairline bg-canvas px-3 py-2">
                    <span className="text-xs font-semibold text-ink">{contact.label}</span>
                    <span className="text-xs font-bold text-navy">{contact.value}</span>
                  </a>
                ) : (
                  <div key={contact.label} className="flex items-center justify-between rounded-md border border-hairline bg-canvas px-3 py-2">
                    <span className="text-xs font-semibold text-ink">{contact.label}</span>
                    <span className="text-xs font-bold text-navy">{contact.value}</span>
                  </div>
                )
              ))}
            </div>
          </div>

          <div className={`${cfg.bg} border-t border-hairline px-4 py-3`}>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">What to do</p>
            <ol className="space-y-2">
              {result.tips.map((tip, i) => (
                <li key={tip} className="flex items-start gap-2 text-sm text-ink">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${cfg.bar}`}>{i + 1}</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="grid grid-cols-2 divide-x divide-hairline border-t border-hairline">
            <button className="py-3 text-center text-xs font-semibold text-muted" disabled={reported} onClick={doReport}>
              {reported ? "Reported to Kavach" : "Report this identifier"}
            </button>
            <a className="py-3 text-center text-xs font-semibold text-highrisk" href="https://cybercrime.gov.in" target="_blank" rel="noreferrer">
              File cybercrime report
            </a>
          </div>
        </div>
      )}

      {result && !loading && (
        <button className="btn-secondary mb-4" onClick={reset}>Check another payment detail</button>
      )}

      {history.length > 0 && !result && !loading && (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Recent directory checks</p>
            <button className="text-xs text-muted underline" onClick={() => { localStorage.removeItem(HISTORY_KEY); setHistory([]); }}>Clear</button>
          </div>
          <div className="space-y-2">
            {history.map((item) => {
              const itemCfg = VERDICT_CFG[item.verdict] ?? VERDICT_CFG.safe;
              return (
                <button key={`${item.identifier}-${item.ts}`} className="flex w-full items-center gap-3 rounded-card border border-hairline bg-surface px-4 py-3 text-left" onClick={() => setIdentifier(item.identifier)}>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full text-[10px] font-black ${itemCfg.bg} ${itemCfg.color}`}>{TYPE_META[item.type].icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{item.identifier}</span>
                    <span className={`text-xs font-semibold ${itemCfg.color}`}>{itemCfg.label}</span>
                  </span>
                  <span className="text-xs text-muted">{new Date(item.ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Layout>
  );
}
