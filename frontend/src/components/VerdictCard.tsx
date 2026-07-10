import { tierStyles } from "../theme/tokens";
import type { ClassifyResponse } from "../api/types";
import RiskBadge from "./RiskBadge";

export default function VerdictCard({ result }: { result: ClassifyResponse }) {
  const s = tierStyles[result.tier];
  return (
    <div className={`card border ${s.border} ${s.bg}`}>
      <div className="mb-2 flex items-center justify-between">
        <RiskBadge tier={result.tier} />
        <span className="text-xs text-muted">confidence {Math.round(result.confidence * 100)}%</span>
      </div>

      {result.reasons.length > 0 && (
        <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-ink">
          {result.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}

      {result.voice_signal && (
        <p className="mb-3 text-sm text-muted">
          Voice authenticity check:{" "}
          <span className="font-medium text-ink">{result.voice_signal.deepfake_likelihood}</span>{" "}
          risk of AI-cloned voice
        </p>
      )}

      {result.playbook && (
        <div className="rounded-card bg-surface p-3">
          <p className="mb-2 text-sm font-semibold text-ink">{result.playbook.title} — what to do next</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
            {result.playbook.steps.map((step) => (
              <li key={step.order}>{step.text}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
