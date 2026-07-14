import { useRef, useState } from "react";
import Layout from "../components/Layout";
import BackHeader from "../components/BackHeader";
import { SearchIcon } from "../components/Icons";
import { currency } from "../api/kavach";
import type { CurrencyCheckResponse } from "../api/types";

export default function CheckCurrency() {
  const [result, setResult] = useState<CurrencyCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setResult(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setLoading(true);
    try {
      setResult(await currency.check(file));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <BackHeader title="Check Currency" subtitle="Photograph a note to verify authenticity" />

      <div className="overflow-hidden rounded-card border border-hairline bg-surface shadow-sm">
        <div className="border-b border-hairline bg-gradient-to-r from-saffron/20 to-canvas px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xl"></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted">Currency Scanner</p>
              <p className="text-xs text-ink">Keep the full note flat, visible, and well-lit.</p>
            </div>
          </div>
        </div>

        <div className="relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden bg-navy text-center">
          {previewUrl ? (
            <img src={previewUrl} alt="Currency preview" className="h-full w-full object-cover" />
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-navy to-navy/50 pointer-events-none" />
              <div className="relative z-10 mb-3 flex h-16 w-16 items-center justify-center rounded-full border border-saffron bg-white text-3xl font-black text-saffron shadow-lg">
                ₹
              </div>
              <p className="relative z-10 max-w-[260px] text-lg font-bold text-white">Position note in frame</p>
              <p className="relative z-10 mt-1 max-w-[260px] text-xs leading-relaxed text-white/70">Ensure good lighting. Avoid folding or blocking security features.</p>
            </>
          )}
          {/* Scanner Viewfinder Overlay */}
          <div className="pointer-events-none absolute inset-6 border-2 border-white/50 rounded-lg">
            {/* Corner markers */}
            <div className="absolute -left-1 -top-1 h-6 w-6 border-l-4 border-t-4 border-saffron rounded-tl-lg" />
            <div className="absolute -right-1 -top-1 h-6 w-6 border-r-4 border-t-4 border-saffron rounded-tr-lg" />
            <div className="absolute -left-1 -bottom-1 h-6 w-6 border-l-4 border-b-4 border-saffron rounded-bl-lg" />
            <div className="absolute -right-1 -bottom-1 h-6 w-6 border-r-4 border-b-4 border-saffron rounded-br-lg" />
          </div>
          {loading && (
            <div className="pointer-events-none absolute left-0 right-0 top-0 h-1 bg-saffron animate-[scan_2s_ease-in-out_infinite]" style={{ boxShadow: '0 0 10px 2px rgba(255, 153, 51, 0.5)' }} />
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="btn-primary flex justify-center items-center gap-2" disabled={loading} onClick={() => cameraInputRef.current?.click()}>
          {loading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          )}
          {loading ? "Scanning..." : "Take Photo"}
        </button>
        <button className="btn-secondary" disabled={loading} onClick={() => uploadInputRef.current?.click()}>
          Upload Gallery
        </button>
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
        <input ref={uploadInputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      </div>

      {!result && !loading && (
        <div className="mt-4 rounded-card border border-hairline bg-canvas px-4 py-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted">Quality Checklist</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              "Flat surface",
              "Good lighting",
              "No glare",
              "Clear focus",
            ].map((label) => (
              <div key={label} className="flex items-center gap-2 rounded-md border border-hairline bg-surface px-3 py-2 shadow-sm">
                <span className="text-sm"><SearchIcon className="w-4 h-4 text-ink/50" /></span>
                <span className="text-xs font-semibold text-ink">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-md bg-highrisk-bg p-3 border border-highrisk/20 flex gap-2">
          <span className="text-highrisk"></span>
          <p className="text-sm font-semibold text-highrisk">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-4 overflow-hidden rounded-card border border-hairline bg-surface shadow-sm animate-in slide-in-from-bottom-2 fade-in">
          <div className={`${result.authenticity.toLowerCase().includes("fake") ? "bg-highrisk-bg" : "bg-safe-bg"} px-4 py-5`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted">Scan Result</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className={`text-2xl font-black capitalize ${result.authenticity.toLowerCase().includes("fake") ? "text-highrisk" : "text-safe"}`}>
                    {result.authenticity}
                  </p>
                  {result.authenticity.toLowerCase().includes("fake") ? (
                    <span className="text-xl"></span>
                  ) : (
                    <span className="text-xl"></span>
                  )}
                </div>
                <p className="mt-1 text-sm font-semibold text-ink">{result.denomination ?? "Denomination Unknown"}</p>
              </div>
              <div className="flex flex-col items-center rounded-xl bg-white p-3 shadow-sm border border-hairline">
                <div className="relative flex h-12 w-12 items-center justify-center">
                  <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-canvas"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className={result.authenticity.toLowerCase().includes("fake") ? "text-highrisk" : "text-safe"}
                      strokeDasharray={`${Math.round(result.confidence * 100)}, 100`}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                  </svg>
                  <span className="text-xs font-black text-navy">{Math.round(result.confidence * 100)}%</span>
                </div>
                <p className="mt-1 text-[8px] font-bold uppercase tracking-wider text-muted">Confidence</p>
              </div>
            </div>
          </div>

          {result.features_checked && result.features_checked.length > 0 && (
            <div className="border-t border-hairline px-4 py-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted">Security Features Verified</p>
              <div className="flex flex-wrap gap-2">
                {result.features_checked.map((feature) => (
                  <span key={feature} className="flex items-center gap-1 rounded-full border border-hairline bg-canvas px-3 py-1 text-xs font-semibold text-ink shadow-sm">
                    <span className="text-[10px] text-safe">✓</span> {feature}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-hairline px-4 py-4 bg-canvas">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted">Detailed Analysis</p>
            <div className="space-y-2">
              {result.message.split("\n").filter(line => line.trim().length > 0).map((line, i) => {
                const isWarning = line.toLowerCase().includes("missing") || line.toLowerCase().includes("failed") || line.toLowerCase().includes("does not");
                return (
                  <div key={i} className="flex gap-3 text-sm">
                    <span className="shrink-0 mt-0.5">{isWarning ? "" : ""}</span>
                    <p className={`font-medium ${isWarning ? "text-highrisk" : "text-ink"}`}>{line}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
