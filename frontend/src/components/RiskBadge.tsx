import { tierStyles, type Tier } from "../theme/tokens";

export default function RiskBadge({ tier }: { tier: Tier }) {
  const s = tierStyles[tier];
  return (
    <span className={`inline-flex items-center rounded-full ${s.bg} ${s.text} px-3 py-1 text-sm font-semibold`}>
      {s.label}
    </span>
  );
}
