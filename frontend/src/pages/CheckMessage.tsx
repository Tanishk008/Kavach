import { useState, useRef } from "react";
import Layout from "../components/Layout";
import BackHeader from "../components/BackHeader";
import { messages, voice, users, ocr } from "../api/kavach";
import type { ClassifyResponse, Tier, VoiceAnalysisResponse } from "../api/types";
import { ShieldIcon, AlertTriangleIcon, HeadsetIcon, SearchIcon, NoteIcon } from "../components/Icons";

// ─────────────────────────────────────────────────────────────────
// VERDICT CONFIG — MESSAGE
// ─────────────────────────────────────────────────────────────────
type VerdictCfg = {
  icon: React.ReactNode; label: string; color: string;
  bg: string; border: string; bar: string;
  urgency: string; bgGrad: string;
};

const VERDICT_CFG: Record<Tier, VerdictCfg> = {
  safe: {
    icon: <ShieldIcon className="w-5 h-5 text-current" />, label: "Safe Message", color: "text-safe",
    bg: "bg-safe-bg", border: "border-safe", bar: "bg-safe",
    urgency: "none", bgGrad: "from-[#E9F5E5] to-[#f0faf0]",
  },
  caution: {
    icon: <AlertTriangleIcon className="w-5 h-5 text-current" />, label: "Suspicious", color: "text-caution",
    bg: "bg-caution-bg", border: "border-caution", bar: "bg-caution",
    urgency: "medium", bgGrad: "from-[#FDF1DC] to-[#fffbf2]",
  },
  high_risk: {
    icon: <AlertTriangleIcon className="w-5 h-5 text-current" />, label: "Confirmed Scam", color: "text-highrisk",
    bg: "bg-highrisk-bg", border: "border-highrisk", bar: "bg-highrisk",
    urgency: "critical", bgGrad: "from-[#FBE9E7] to-[#fff0ef]",
  },
};

const URGENCY_LABEL: Record<string, { text: string; cls: string }> = {
  critical: { text: "Do NOT click links", cls: "bg-highrisk text-white" },
  high:     { text: "Be very careful",    cls: "bg-caution text-white" },
  medium:   { text: "Exercise caution",   cls: "bg-caution/80 text-white" },
  low:      { text: "Proceed carefully",  cls: "bg-muted text-white" },
  none:     { text: "Appears Safe",       cls: "bg-safe text-white" },
};

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
// VOICE VERDICT CONFIG
// ─────────────────────────────────────────────────────────────────
const VOICE_VERDICT_CFG = {
  human: {
    icon: <HeadsetIcon className="w-5 h-5 text-current" />, label: "Human Voice", color: "text-safe",
    bg: "bg-safe-bg", border: "border-safe",
    bgGrad: "from-[#E9F5E5] to-[#f0faf0]",
    description: "This voice note shows natural human speech characteristics.",
  },
  ai_generated: {
    icon: <NoteIcon className="w-5 h-5 text-current" />, label: "Likely AI-Generated", color: "text-highrisk",
    bg: "bg-highrisk-bg", border: "border-highrisk",
    bgGrad: "from-[#FBE9E7] to-[#fff0ef]",
    description: "This voice note shows strong signs of AI/TTS voice synthesis — a deepfake voice.",
  },
  uncertain: {
    icon: <SearchIcon className="w-5 h-5 text-current" />, label: "Uncertain", color: "text-caution",
    bg: "bg-caution-bg", border: "border-caution",
    bgGrad: "from-[#FDF1DC] to-[#fffbf2]",
    description: "Unable to determine conclusively if this is AI or human. Treat with caution.",
  },
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
const VOICE_STEPS = [
  "Loading audio file…",
  "Extracting speech features…",
  "Analysing pitch & tone…",
  "Running deepfake detection…",
];

// ─────────────────────────────────────────────────────────────────
// OFFLINE FALLBACK
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

function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  const sampleCount = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, sampleCount * 2, true);

  let offset = 44;
  chunks.forEach((chunk) => {
    for (let i = 0; i < chunk.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, chunk[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  });

  return new Blob([buffer], { type: "audio/wav" });
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function CheckMessage() {
  const [activeTab, setActiveTab] = useState<"text" | "voice">("text");

  // ── Text tab state ──
  const [text, setText] = useState("");
  const [result, setResult] = useState<ClassifyResponse | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>(getHistory);
  const [reported, setReported] = useState(false);
  const [copied, setCopied] = useState(false);
  const [screenshotPreview, setScreenshotPreview] = useState("");
  const [screenshotName, setScreenshotName] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);

  // ── Voice tab state ──
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voiceResult, setVoiceResult] = useState<VoiceAnalysisResponse | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceStep, setVoiceStep] = useState(0);
  const [voiceError, setVoiceError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const scanTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const audioSampleRateRef = useRef(44100);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canCheck = text.trim().length > 5;

  // ── Text: check ──
  const check = async () => {
    if (!canCheck) return;
    setResult(null); setIsOffline(false); setReported(false); setCopied(false);
    setLoading(true); setScanStep(0);
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
      users.incrementScore(5).catch(console.error);
    } catch {
      const res = offlineFallback();
      setResult(res); setIsOffline(true);
      saveHistory({ text: input, tier: res.tier, ts: Date.now() });
    } finally {
      if (scanTimer.current) clearInterval(scanTimer.current);
      setLoading(false); setHistory(getHistory());
    }
  };

  const resetCheck = () => {
    setResult(null); setIsOffline(false); setText(""); setReported(false);
    setScreenshotPreview(""); setScreenshotName("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const copyResult = () => {
    if (!result) return;
    const cfg = VERDICT_CFG[result.tier];
    const text = `Kavach Scan Result\n${cfg.label} (${result.risk_score}/100)\n${result.reasons.join("\n")}`;
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const handleScreenshot = async (file: File) => {
    if (screenshotPreview) URL.revokeObjectURL(screenshotPreview);
    setScreenshotPreview(URL.createObjectURL(file));
    setScreenshotName(file.name);
    setResult(null);
    setIsOffline(false);
    
    setOcrLoading(true);
    try {
      const res = await ocr.extract(file);
      if (res.text) {
        setText(res.text);
      }
    } catch (e: unknown) {
      console.error("OCR failed", e);
      // Fallback silently if it fails, user can still type manually
    } finally {
      setOcrLoading(false);
    }
  };

  // ── Voice: file upload ──
  const handleVoiceFile = (file: File) => {
    setVoiceFile(file); setVoiceResult(null); setVoiceError("");
    setRecordedBlob(null);
  };

  // ── Voice: recording ──
  const startRecording = async () => {
    setVoiceError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) throw new Error("Audio recording is not supported in this browser.");
      const audioContext = new AudioContextCtor();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      audioChunksRef.current = [];
      audioSampleRateRef.current = audioContext.sampleRate;
      processor.onaudioprocess = (event) => {
        audioChunksRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(audioContext.destination);
      audioContextRef.current = audioContext;
      audioSourceRef.current = source;
      audioProcessorRef.current = processor;
      audioStreamRef.current = stream;
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
    } catch {
      setVoiceError("Microphone access denied. Please allow microphone access or upload a file instead.");
    }
  };

  const stopRecording = () => {
    audioProcessorRef.current?.disconnect();
    audioSourceRef.current?.disconnect();
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioContextRef.current?.close().catch(() => {});
    audioProcessorRef.current = null;
    audioSourceRef.current = null;
    audioStreamRef.current = null;
    audioContextRef.current = null;
    if (audioChunksRef.current.length > 0) {
      const blob = encodeWav(audioChunksRef.current, audioSampleRateRef.current);
      setRecordedBlob(blob);
      setVoiceFile(null);
      setVoiceResult(null);
    }
    setIsRecording(false);
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  };

  // ── Voice: analyse ──
  const analyseVoice = async () => {
    const fileToAnalyse = voiceFile ?? (recordedBlob ? new File([recordedBlob], "recording.wav", { type: "audio/wav" }) : null);
    if (!fileToAnalyse) return;
    setVoiceResult(null); setVoiceError("");
    setVoiceLoading(true); setVoiceStep(0);
    let step = 0;
    scanTimer.current = setInterval(() => {
      step = Math.min(step + 1, VOICE_STEPS.length - 1);
      setVoiceStep(step);
    }, 700);
    try {
      const res = await voice.analyze(fileToAnalyse);
      setVoiceResult(res);
    } catch (e: unknown) {
      setVoiceError("Could not analyse this audio. The backend may be offline or the file format unsupported. Try a .wav or .ogg file.");
    } finally {
      if (scanTimer.current) clearInterval(scanTimer.current);
      setVoiceLoading(false);
    }
  };

  const resetVoice = () => {
    setVoiceFile(null); setRecordedBlob(null); setVoiceResult(null);
    setVoiceError(""); setRecordSeconds(0);
  };

  const cfg = result ? VERDICT_CFG[result.tier] : null;
  const urgencyInfo = cfg ? URGENCY_LABEL[cfg.urgency] : null;
  const scamLabel = result?.scam_type ? SCAM_TYPE_LABEL[result.scam_type] ?? result.scam_type : null;
  const vcfg = voiceResult ? VOICE_VERDICT_CFG[voiceResult.verdict] : null;

  const hasVoiceInput = !!(voiceFile || recordedBlob);

  return (
    <Layout>
      <BackHeader
        title="Check Message & Voice"
        subtitle="Detect scam texts and AI-generated voice notes"
      />

      {/* ── TABS ── */}
      <div className="mb-4 flex rounded-card border border-hairline bg-canvas p-1 gap-1">
        {(["text", "voice"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
              activeTab === tab
                ? "bg-saffron text-white shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            {tab === "text" ? " Text / SMS" : " Voice Note"}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════
          TEXT TAB
          ════════════════════════════════════════════ */}
      {activeTab === "text" && (
        <>
          {/* Input card */}
          <div className="card mb-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                Paste Suspicious Message
              </p>
              <span className="text-[10px] text-muted">{text.length} chars</span>
            </div>

            <textarea
              ref={inputRef}
              className="input min-h-[120px] w-full resize-none text-sm leading-relaxed"
              placeholder="e.g., 'Dear customer, your electricity will be disconnected tonight at 9:30 PM. Call officer on 9876543210'"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) check(); }}
            />

            <input
              ref={screenshotInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleScreenshot(e.target.files[0]); }}
            />

            <div className="mt-3 rounded-card border border-hairline bg-canvas px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted">Screenshot OCR</p>
                  <p className="mt-0.5 text-xs text-muted">
                    Upload a chat/SMS screenshot to automatically extract text for scanning.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={ocrLoading}
                  className="shrink-0 rounded-md border border-saffron/30 bg-surface px-3 py-2 text-xs font-bold text-navy"
                  onClick={() => screenshotInputRef.current?.click()}
                >
                  {ocrLoading ? "Extracting..." : "Upload"}
                </button>
              </div>
              {screenshotPreview && (
                <div className="mt-3 flex items-center gap-3 rounded-md border border-hairline bg-surface p-2">
                  <img src={screenshotPreview} alt="Uploaded message screenshot" className="h-16 w-12 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-ink">{screenshotName}</p>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {ocrLoading ? "Extracting text using AI..." : "Text extracted and pasted above."}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-bold text-highrisk"
                    onClick={() => { setScreenshotPreview(""); setScreenshotName(""); }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                className="btn-primary flex flex-1 items-center justify-center gap-2"
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
              {text && (
                <button
                  onClick={() => setText("")}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card border border-hairline bg-surface text-muted transition hover:bg-canvas"
                  title="Clear"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Loading skeleton */}
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

          {/* Offline notice */}
          {result && isOffline && !loading && (
            <div className="mb-3 flex items-center gap-2 rounded-card border border-caution/40 bg-caution-bg px-3 py-2">
              <span className="text-sm"></span>
              <p className="text-xs font-medium text-caution">
                Offline estimate — could not reach the Kavach server.
              </p>
            </div>
          )}

          {/* Result card */}
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
                      <p className="mt-0.5 text-sm font-semibold text-ink">Type: {scamLabel}</p>
                    )}
                    <span className="mt-1 inline-block text-xs text-muted">
                      Confidence: {Math.round(result.confidence * 100)}%
                    </span>
                  </div>
                </div>

                {/* Threat level */}
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted uppercase tracking-wide">Threat Level</span>
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

              {/* Analysis */}
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

              {/* Extracted elements */}
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
                              {risky ? "" : ""} {u.url} <span className="font-bold">({u.risk_score}/100)</span>
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
                             "{kw}"
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Playbook */}
              {result.playbook && (
                <div className={`border-t border-hairline px-4 py-3 ${cfg.bg}`}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">{result.playbook.title}</p>
                  <ol className="space-y-2">
                    {result.playbook.steps.map((step) => (
                      <li key={step.order} className="flex items-start gap-3 text-sm text-ink">
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${cfg.bar}`}>
                          {step.order}
                        </span>
                        {step.text}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Action buttons */}
              <div className="border-t border-hairline bg-surface">
                <div className="grid grid-cols-2 divide-x divide-hairline">
                  <button
                    onClick={() => setReported(true)}
                    disabled={reported}
                    className={`flex flex-col items-center gap-1 py-3 text-center transition ${reported ? "opacity-50" : "hover:bg-canvas"}`}
                  >
                    <span className="text-lg">{reported ? "" : ""}</span>
                    <span className="text-[10px] font-semibold text-muted">{reported ? "Reported" : "Report"}</span>
                  </button>
                  <button
                    onClick={copyResult}
                    className="flex flex-col items-center gap-1 py-3 text-center transition hover:bg-canvas"
                  >
                    <span className="text-lg">{copied ? "" : ""}</span>
                    <span className="text-[10px] font-semibold text-muted">{copied ? "Copied!" : "Copy Result"}</span>
                  </button>
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
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Check another */}
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

          {/* Recent scans */}
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
                        <p className="truncate text-sm font-medium text-ink">"{h.text}"</p>
                        <p className={`text-xs font-semibold ${c.color}`}>{c.label}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* How it works */}
          {!result && !loading && (
            <div className="rounded-card border border-hairline bg-canvas px-4 py-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted"> How Kavach Scans</p>
              <div className="space-y-2">
                {[
                  { text: "Analyses every link for shorteners, raw IPs, punycode, lookalike domains, and .apk downloads" },
                  { text: "Scores urgency and threat keywords across 12+ known scam categories" },
                  { text: "Recognises genuine bank/NBFC transaction alerts so real SMS aren't flagged" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-sm mt-0.5"><SearchIcon className="w-4 h-4 text-ink/50" /></span>
                    <p className="text-xs leading-relaxed text-muted">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════
          VOICE TAB
          ════════════════════════════════════════════ */}
      {activeTab === "voice" && (
        <>
          {/* Explainer banner */}
          <div className="mb-4 rounded-card border border-caution/30 bg-caution-bg px-4 py-3">
            <p className="text-xs font-bold text-caution mb-1"> AI Voice Deepfake Detection</p>
            <p className="text-xs text-muted leading-relaxed">
              Scammers use AI voice cloning to impersonate bank officers, police, and family members.
              Upload a suspicious voice note to check if it was generated by AI.
            </p>
          </div>

          {/* Input section */}
          {!voiceResult && (
            <div className="card mb-4 space-y-4">
              {/* Record */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Record Live</p>
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="flex w-full items-center justify-center gap-2 rounded-card border-2 border-dashed border-highrisk/40 bg-highrisk-bg py-4 text-sm font-semibold text-highrisk transition hover:border-highrisk hover:bg-highrisk/15"
                  >
                    <span className="text-xl"></span>
                    {recordedBlob ? `Re-record (${recordSeconds}s recorded)` : "Tap to Record Voice Note"}
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="flex w-full items-center justify-center gap-2 rounded-card border-2 border-highrisk bg-highrisk py-4 text-sm font-semibold text-white transition hover:bg-highrisk/80"
                  >
                    <span className="h-3 w-3 rounded-sm bg-white animate-pulse" />
                    Recording… {recordSeconds}s — Tap to stop
                  </button>
                )}
                {recordedBlob && !isRecording && (
                  <p className="mt-1.5 text-xs text-safe font-medium">✓ {recordSeconds}s recorded — ready to analyse</p>
                )}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-2 text-xs text-muted">
                <div className="flex-1 h-px bg-hairline" />
                <span>or upload a file</span>
                <div className="flex-1 h-px bg-hairline" />
              </div>

              {/* File upload */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.wav,.mp3,.ogg,.m4a"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleVoiceFile(e.target.files[0]); }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-card border border-hairline bg-surface py-3.5 text-sm font-medium text-ink transition hover:bg-canvas"
                >
                  <span className="text-lg"></span>
                  {voiceFile ? voiceFile.name : "Upload Voice Note (.wav, .mp3, .ogg, .m4a)"}
                </button>
              </div>

              {/* Analyse button */}
              <button
                onClick={analyseVoice}
                disabled={voiceLoading || (!hasVoiceInput)}
                className="btn-primary flex items-center justify-center gap-2"
              >
                {voiceLoading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                      <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    {VOICE_STEPS[voiceStep]}
                  </>
                ) : (
                  <>
                    <span></span>
                    Analyse Voice Note
                  </>
                )}
              </button>
            </div>
          )}

          {/* Loading skeleton */}
          {voiceLoading && (
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

          {/* Error */}
          {voiceError && (
            <div className="mb-3 rounded-card border border-highrisk/40 bg-highrisk-bg px-3 py-2">
              <p className="text-xs font-medium text-highrisk"> {voiceError}</p>
            </div>
          )}

          {/* Voice result */}
          {voiceResult && vcfg && !voiceLoading && (
            <div className="mb-4 overflow-hidden rounded-card border border-hairline shadow-sm">
              {/* Header */}
              <div className={`bg-gradient-to-br ${vcfg.bgGrad} px-4 pt-4 pb-4`}>
                <div className="flex items-start gap-3">
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 ${vcfg.border} ${vcfg.bg} text-2xl`}>
                    {vcfg.icon}
                  </div>
                  <div className="flex-1">
                    <p className={`text-base font-bold ${vcfg.color}`}>{vcfg.label}</p>
                    <p className="text-xs text-muted mt-0.5">{vcfg.description}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-xs text-muted">Confidence:</span>
                      <span className={`text-sm font-black ${vcfg.color}`}>{Math.round(voiceResult.confidence * 100)}%</span>
                      {voiceResult.duration_seconds && (
                        <span className="text-xs text-muted">· {voiceResult.duration_seconds}s audio</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Confidence bar */}
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted uppercase tracking-wide">Confidence</span>
                    <span className={`text-sm font-black ${vcfg.color}`}>{Math.round(voiceResult.confidence * 100)}%</span>
                  </div>
                  <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-hairline">
                    <div
                      className={`absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ${
                        voiceResult.verdict === "ai_generated" ? "bg-highrisk" :
                        voiceResult.verdict === "uncertain" ? "bg-caution" : "bg-safe"
                      }`}
                      style={{ width: `${voiceResult.confidence * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Detection signals */}
              <div className="border-t border-hairline bg-surface px-4 py-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted">Detection Signals</p>
                  {voiceResult.processing_note && (
                    <span className="rounded-full border border-hairline bg-canvas px-2 py-0.5 text-[10px] font-bold text-navy">
                      {voiceResult.processing_note}
                    </span>
                  )}
                </div>
                <ul className="space-y-1.5">
                  {voiceResult.signals.map((s, i) => (
                    <li key={i} className={`flex items-start gap-2 text-sm ${vcfg.color}`}>
                      <span className="mt-0.5 shrink-0 font-bold">•</span>
                      <span className="text-ink">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Advice */}
              <div className={`border-t border-hairline px-4 py-3 ${vcfg.bg}`}>
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-muted">What to do</p>
                <p className="text-sm text-ink leading-relaxed">{voiceResult.advice}</p>
              </div>

              {/* Actions */}
              {voiceResult.verdict === "ai_generated" && (
                <div className="border-t border-hairline bg-surface px-4 py-3">
                  <a
                    href="https://cybercrime.gov.in"
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-card bg-highrisk/8 py-2.5 text-sm font-semibold text-highrisk transition hover:bg-highrisk/15"
                  >
                     Report to National Cyber Crime Portal
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Check another */}
          {voiceResult && !voiceLoading && (
            <button
              onClick={resetVoice}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-card border-2 border-dashed border-saffron/50 bg-canvas py-3.5 text-sm font-semibold text-navy transition hover:border-saffron hover:bg-saffron/5"
            >
              <svg className="h-4 w-4 text-saffron" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Analyse Another Voice Note
            </button>
          )}

          {/* How it works */}
          {!voiceResult && !voiceLoading && (
            <div className="rounded-card border border-hairline bg-canvas px-4 py-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted"> How Voice Detection Works</p>
              <div className="space-y-2">
                {[
                  { text: "Analyses MFCC (vocal fingerprint) variance — AI voices are unnaturally uniform" },
                  { text: "Checks pitch trajectory — TTS voices often have robotic, flat intonation" },
                  { text: "Measures spectral and energy dynamics — human speech breathes, AI doesn't" },
                  { text: "Zero-crossing rate analysis detects unnaturally smooth transitions" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-sm mt-0.5"><SearchIcon className="w-4 h-4 text-ink/50" /></span>
                    <p className="text-xs leading-relaxed text-muted">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
