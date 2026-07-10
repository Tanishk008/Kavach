import { useState } from "react";
import Layout from "../components/Layout";
import { currency } from "../api/kavach";
import type { CurrencyCheckResponse } from "../api/types";

export default function CheckCurrency() {
  const [result, setResult] = useState<CurrencyCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setLoading(true);
    try {
      setResult(await currency.check(file));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const badgeClass =
    result?.authenticity === "real"
      ? "bg-safe-bg text-safe"
      : result?.authenticity === "fake"
      ? "bg-highrisk-bg text-highrisk"
      : "bg-caution-bg text-caution";

  return (
    <Layout>
      <h1 className="mb-3 text-xl font-semibold text-ink">Check currency</h1>

      <div className="card flex aspect-[4/3] flex-col items-center justify-center border-dashed text-center text-muted">
        <p>Place the note flat inside the frame</p>
        <p className="mt-1 text-xs">Good lighting, front side up</p>
      </div>

      <label className="btn-primary mt-4 block cursor-pointer text-center">
        {loading ? "Checking…" : "Capture / upload photo"}
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      </label>

      {error && <p className="mt-3 text-sm text-highrisk">{error}</p>}

      {result && (
        <div className="card mt-4">
          <p className="text-2xl font-semibold text-ink">₹{result.denomination ?? "—"}</p>
          <span className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-semibold ${badgeClass}`}>
            {result.authenticity === "real"
              ? "Likely genuine"
              : result.authenticity === "fake"
              ? "Likely fake"
              : "Uncertain — retake photo"}
          </span>
          <p className="mt-2 text-sm text-muted">{result.message}</p>
          {result.features_checked.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-navy">Why?</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
                {result.features_checked.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Layout>
  );
}
