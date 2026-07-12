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
        <div className="card mt-4 space-y-1.5 p-4 border bg-surface">
          {result.message.split("\n").map((line, i) => (
            <p key={i} className="text-sm font-medium text-ink whitespace-pre-wrap">
              {line}
            </p>
          ))}
        </div>
      )}
    </Layout>
  );
}
