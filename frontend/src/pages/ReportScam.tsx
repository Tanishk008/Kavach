import { useState } from "react";
import Layout from "../components/Layout";
import BackHeader from "../components/BackHeader";
import { api } from "../api/client";

interface CaseFileResponse {
  case_id: string;
  sha256_hash: string;
  ncrp_draft: Record<string, unknown>;
}

export default function ReportScam() {
  const [summary, setSummary] = useState("");
  const [caseFile, setCaseFile] = useState<CaseFileResponse | null>(null);
  const [error, setError] = useState("");

  const generate = async () => {
    setError("");
    try {
      const res = await api.post<CaseFileResponse>("/api/evidence/case", {
        content: { summary, scam_type: "digital_arrest", tier: "high_risk" },
      });
      setCaseFile(res);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Layout>
      <BackHeader title="Report a Scam" subtitle="Generate a tamper-evident case file" />
      <textarea
        className="input min-h-[96px] resize-none"
        rows={4}
        placeholder="Describe what happened (message, number, or transaction)…"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
      />
      
      {error && <p className="mt-3 text-sm text-highrisk">{error}</p>}

      <button className="btn-primary mt-4" disabled={!summary.trim()} onClick={generate}>
        Generate case file
      </button>

      {caseFile && (
        <div className="card mt-4">
          <p className="font-medium text-ink">Case file</p>
          <p className="mt-1 text-xs text-muted">Reference: {caseFile.case_id}</p>
          <p className="break-all text-xs text-muted">Hash: {caseFile.sha256_hash}</p>
          <p className="mt-2 text-xs text-india">This file is tamper-evident and ready to submit.</p>
          <div className="mt-3 flex gap-2">
            <button className="btn-secondary">
              Download case file
            </button>
            <button className="btn-primary" onClick={() => window.open("https://cybercrime.gov.in", "_blank")}>
              Submit to NCRP
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
