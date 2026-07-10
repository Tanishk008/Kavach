import { useState } from "react";
import Layout from "../components/Layout";
import { pay } from "../api/kavach";
import type { PayCheckResponse } from "../api/types";

export default function CheckBeforePay() {
  const [identifier, setIdentifier] = useState("");
  const [result, setResult] = useState<PayCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const check = async () => {
    setError("");
    setLoading(true);
    try {
      setResult(await pay.check(identifier.trim()));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <h1 className="mb-3 text-xl font-semibold text-ink">Check before you pay</h1>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Enter UPI ID, account number, or phone number"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        <button className="btn-primary w-auto px-5" disabled={loading || !identifier} onClick={check}>
          Check
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-highrisk">{error}</p>}

      {result && (
        <div
          className={`card mt-4 border ${
            result.flagged ? "border-highrisk bg-highrisk-bg" : "border-hairline"
          }`}
        >
          <p className={`text-lg font-semibold ${result.flagged ? "text-highrisk" : "text-ink"}`}>
            {result.flagged ? "Flagged" : "No red flags found"}
          </p>
          <p className="mt-1 text-sm text-ink">{result.explanation}</p>
          {result.flagged && (
            <button className="btn-primary mt-3" onClick={() => window.open("https://cybercrime.gov.in", "_blank")}>
              Report to NCRP
            </button>
          )}
        </div>
      )}
    </Layout>
  );
}
