import type { StatsData } from "../../api/intelligence";
import { ShieldIcon, AlertTriangleIcon, MessageIcon, MapPinIcon } from "../Icons";

const CRIME_TYPE_ICONS: Record<string, React.ReactNode> = {
  "UPI Scam": <AlertTriangleIcon className="w-5 h-5 text-current"/>,
  "Digital Arrest": <AlertTriangleIcon className="w-5 h-5 text-current"/>,
  "OTP Fraud": <AlertTriangleIcon className="w-5 h-5 text-current"/>,
  "Investment Scam": <AlertTriangleIcon className="w-5 h-5 text-current"/>,
  "Phishing": <AlertTriangleIcon className="w-5 h-5 text-current"/>,
  "Online Banking Fraud": <AlertTriangleIcon className="w-5 h-5 text-current"/>,
  "Crypto Scam": <AlertTriangleIcon className="w-5 h-5 text-current"/>,
  "WhatsApp Scam": <MessageIcon className="w-5 h-5 text-current"/>,
  "Loan App Fraud": <AlertTriangleIcon className="w-5 h-5 text-current"/>,
};

function formatCurrency(amount: number): string {
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(1)}Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
  return `₹${amount.toFixed(0)}`;
}

interface StatsCardsProps {
  stats: StatsData | null;
  loading: boolean;
}

export default function StatsCards({ stats, loading }: StatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="stat-card animate-pulse"
            style={{ height: "90px", background: "rgba(255,255,255,0.05)", borderRadius: "12px" }}
          />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const topCrime = stats.top_crime_types[0];
  const topState = stats.top_states[0];

  const cards = [
    {
      label: "Total Incidents",
      value: stats.total_events.toLocaleString(),
      sub: `+${stats.total_events_last_30_days} this month`,
      icon: <ShieldIcon className="w-5 h-5 text-current"/>,
      color: "#ef4444",
    },
    {
      label: "Money Lost",
      value: formatCurrency(stats.total_money_lost_inr),
      sub: `${stats.total_victims.toLocaleString()} victims`,
      icon: <AlertTriangleIcon className="w-5 h-5 text-current"/>,
      color: "#f59e0b",
    },
    {
      label: "Top Crime",
      value: topCrime?.crime_type ?? "—",
      sub: topCrime ? `${topCrime.count} incidents` : "",
      icon: CRIME_TYPE_ICONS[topCrime?.crime_type ?? ""] ?? <AlertTriangleIcon className="w-5 h-5 text-current"/>,
      color: "#8b5cf6",
    },
    {
      label: "Most Affected",
      value: topState?.state ?? "—",
      sub: topState ? `Risk: ${topState.risk_score.toFixed(0)}/100` : "",
      icon: <MapPinIcon className="w-5 h-5 text-current"/>,
      color: "#06b6d4",
    },
  ];

  return (
    <div className="stats-grid">
      {cards.map((card) => (
        <div className="stat-card" key={card.label} style={{ borderLeft: `3px solid ${card.color}` }}>
          <div className="stat-icon">{card.icon}</div>
          <div className="stat-content">
            <div className="stat-value">{card.value}</div>
            <div className="stat-label">{card.label}</div>
            {card.sub && <div className="stat-sub">{card.sub}</div>}
          </div>
        </div>
      ))}

      {/* Pipeline status indicator */}
      <div className="pipeline-status" style={{ gridColumn: "1 / -1" }}>
        <span
          className="pipeline-dot"
          style={{ background: stats.pipeline.scheduler_running ? "#22c55e" : "#f59e0b" }}
        />
        <span className="pipeline-text">
          Pipeline: {stats.pipeline.scheduler_running ? "Running" : "Idle"} |{" "}
          {stats.pipeline.total_articles_collected} articles collected |{" "}
          {stats.pipeline.total_events_geocoded} geocoded |{" "}
          {stats.pipeline.total_hotspots_computed} hotspots
          {stats.pipeline.last_run_at && (
            <> | Last run: {new Date(stats.pipeline.last_run_at).toLocaleTimeString()}</>
          )}
        </span>
      </div>
    </div>
  );
}
