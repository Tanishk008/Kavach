/**
 * Crime type filter sidebar.
 * Shows toggleable crime type chips and a state selector.
 */

export const ALL_CRIME_TYPES = [
  "UPI Scam",
  "Digital Arrest",
  "OTP Fraud",
  "Investment Scam",
  "Phishing",
  "Online Banking Fraud",
  "Crypto Scam",
  "WhatsApp Scam",
  "Loan App Fraud",
  "Vishing",
  "SIM Swap",
  "Credit Card Fraud",
  "Sextortion",
  "Job Fraud",
  "Ransomware",
];

const CRIME_COLORS: Record<string, string> = {
  "Digital Arrest": "#ef4444",
  "Investment Scam": "#f59e0b",
  "Crypto Scam": "#8b5cf6",
  "Online Banking Fraud": "#06b6d4",
  "UPI Scam": "#10b981",
  "Phishing": "#f97316",
  "OTP Fraud": "#ec4899",
  "WhatsApp Scam": "#84cc16",
  "Loan App Fraud": "#14b8a6",
  "Vishing": "#a78bfa",
  "SIM Swap": "#fb923c",
  "Credit Card Fraud": "#38bdf8",
  "Sextortion": "#f43f5e",
  "Job Fraud": "#4ade80",
  "Ransomware": "#c084fc",
};

export function getCrimeColor(crimeType: string | null | undefined): string {
  if (!crimeType) return "#94a3b8";
  return CRIME_COLORS[crimeType] || "#94a3b8";
}

const INDIAN_STATES = [
  "All States",
  "Andhra Pradesh", "Assam", "Bihar", "Delhi", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Odisha",
  "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh",
  "Uttarakhand", "West Bengal",
];

interface CrimeFiltersProps {
  selectedTypes: Set<string>;
  selectedState: string;
  onTypeToggle: (type: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onStateChange: (state: string) => void;
  eventCount: number;
}

export default function CrimeFilters({
  selectedTypes,
  selectedState,
  onTypeToggle,
  onSelectAll,
  onClearAll,
  onStateChange,
  eventCount,
}: CrimeFiltersProps) {
  return (
    <div className="filters-panel">
      <div className="filters-header">
        <h3 className="filters-title"> Filters</h3>
        <span className="event-badge">{eventCount} events</span>
      </div>

      {/* State selector */}
      <div className="filter-section">
        <label className="filter-label">State</label>
        <select
          className="filter-select"
          value={selectedState}
          onChange={(e) => onStateChange(e.target.value)}
        >
          {INDIAN_STATES.map((s) => (
            <option key={s} value={s === "All States" ? "" : s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Crime type toggles */}
      <div className="filter-section">
        <div className="filter-label-row">
          <label className="filter-label">Crime Types</label>
          <div className="filter-actions">
            <button className="filter-action-btn" onClick={onSelectAll}>All</button>
            <span className="filter-divider">|</span>
            <button className="filter-action-btn" onClick={onClearAll}>None</button>
          </div>
        </div>

        <div className="crime-chips">
          {ALL_CRIME_TYPES.map((type) => {
            const active = selectedTypes.has(type);
            const color = getCrimeColor(type);
            return (
              <button
                key={type}
                className={`crime-chip ${active ? "active" : ""}`}
                style={active ? { background: color + "33", borderColor: color, color } : {}}
                onClick={() => onTypeToggle(type)}
              >
                <span
                  className="crime-chip-dot"
                  style={{ background: active ? color : "#475569" }}
                />
                {type}
              </button>
            );
          })}
        </div>
      </div>

      {/* Risk legend */}
      <div className="filter-section">
        <label className="filter-label">Risk Level</label>
        <div className="risk-legend">
          {[
            { level: "Critical", color: "#ef4444", range: "76–100" },
            { level: "High", color: "#f97316", range: "51–75" },
            { level: "Medium", color: "#eab308", range: "26–50" },
            { level: "Low", color: "#22c55e", range: "0–25" },
          ].map(({ level, color, range }) => (
            <div className="legend-row" key={level}>
              <span className="legend-dot" style={{ background: color }} />
              <span className="legend-level">{level}</span>
              <span className="legend-range">{range}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
