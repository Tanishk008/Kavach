import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { intelligenceApi, type HotspotItem, type StatsData } from "../api/intelligence";
import Layout from "../components/Layout";
import { MapPinIcon, ShieldIcon } from "../components/Icons";

const INDIA_CENTER: [number, number] = [23.5, 78.8];
const INDIA_ZOOM = 4;

const INDIAN_WATCHLIST_HOTSPOTS: HotspotItem[] = [
  {
    id: "demo-delhi",
    city: "Delhi",
    district: null,
    state: "Delhi",
    latitude: 28.6139,
    longitude: 77.209,
    risk_score: 88,
    risk_level: "critical",
    incident_count: 142,
    recent_incident_count: 48,
    total_money_lost_inr: 85000000,
    avg_confidence: 0.78,
    top_crime_types: ["Digital Arrest", "UPI Scam"],
    last_incident_at: new Date().toISOString(),
    computed_at: new Date().toISOString(),
  },
  {
    id: "demo-mumbai",
    city: "Mumbai",
    district: null,
    state: "Maharashtra",
    latitude: 19.076,
    longitude: 72.8777,
    risk_score: 79,
    risk_level: "critical",
    incident_count: 118,
    recent_incident_count: 41,
    total_money_lost_inr: 124000000,
    avg_confidence: 0.82,
    top_crime_types: ["Investment Scam", "Online Banking Fraud"],
    last_incident_at: new Date().toISOString(),
    computed_at: new Date().toISOString(),
  },
  {
    id: "demo-bengaluru",
    city: "Bengaluru",
    district: null,
    state: "Karnataka",
    latitude: 12.9716,
    longitude: 77.5946,
    risk_score: 72,
    risk_level: "high",
    incident_count: 95,
    recent_incident_count: 33,
    total_money_lost_inr: 67000000,
    avg_confidence: 0.75,
    top_crime_types: ["Phishing", "OTP Fraud"],
    last_incident_at: new Date().toISOString(),
    computed_at: new Date().toISOString(),
  },
  {
    id: "demo-hyderabad",
    city: "Hyderabad",
    district: null,
    state: "Telangana",
    latitude: 17.385,
    longitude: 78.4867,
    risk_score: 65,
    risk_level: "high",
    incident_count: 72,
    recent_incident_count: 26,
    total_money_lost_inr: 43000000,
    avg_confidence: 0.71,
    top_crime_types: ["UPI Scam", "WhatsApp Scam"],
    last_incident_at: new Date().toISOString(),
    computed_at: new Date().toISOString(),
  },
  {
    id: "demo-ahmedabad",
    city: "Ahmedabad",
    district: null,
    state: "Gujarat",
    latitude: 23.0225,
    longitude: 72.5714,
    risk_score: 58,
    risk_level: "high",
    incident_count: 61,
    recent_incident_count: 22,
    total_money_lost_inr: 38000000,
    avg_confidence: 0.69,
    top_crime_types: ["Loan App Fraud", "Investment Scam"],
    last_incident_at: new Date().toISOString(),
    computed_at: new Date().toISOString(),
  },
  {
    id: "demo-jaipur",
    city: "Jaipur",
    district: null,
    state: "Rajasthan",
    latitude: 26.9124,
    longitude: 75.7873,
    risk_score: 52,
    risk_level: "high",
    incident_count: 54,
    recent_incident_count: 19,
    total_money_lost_inr: 31000000,
    avg_confidence: 0.67,
    top_crime_types: ["Digital Arrest", "OTP Fraud"],
    last_incident_at: new Date().toISOString(),
    computed_at: new Date().toISOString(),
  },
  {
    id: "demo-pune",
    city: "Pune",
    district: null,
    state: "Maharashtra",
    latitude: 18.5204,
    longitude: 73.8567,
    risk_score: 47,
    risk_level: "medium",
    incident_count: 48,
    recent_incident_count: 17,
    total_money_lost_inr: 25000000,
    avg_confidence: 0.73,
    top_crime_types: ["Crypto Scam", "Phishing"],
    last_incident_at: new Date().toISOString(),
    computed_at: new Date().toISOString(),
  },
  {
    id: "demo-chennai",
    city: "Chennai",
    district: null,
    state: "Tamil Nadu",
    latitude: 13.0827,
    longitude: 80.2707,
    risk_score: 43,
    risk_level: "medium",
    incident_count: 42,
    recent_incident_count: 15,
    total_money_lost_inr: 19000000,
    avg_confidence: 0.7,
    top_crime_types: ["Vishing", "Credit Card Fraud"],
    last_incident_at: new Date().toISOString(),
    computed_at: new Date().toISOString(),
  },
  {
    id: "demo-kolkata",
    city: "Kolkata",
    district: null,
    state: "West Bengal",
    latitude: 22.5726,
    longitude: 88.3639,
    risk_score: 39,
    risk_level: "medium",
    incident_count: 31,
    recent_incident_count: 10,
    total_money_lost_inr: 11000000,
    avg_confidence: 0.63,
    top_crime_types: ["WhatsApp Scam", "Loan App Fraud"],
    last_incident_at: new Date().toISOString(),
    computed_at: new Date().toISOString(),
  },
  {
    id: "demo-guwahati",
    city: "Guwahati",
    district: null,
    state: "Assam",
    latitude: 26.1445,
    longitude: 91.7362,
    risk_score: 34,
    risk_level: "medium",
    incident_count: 24,
    recent_incident_count: 8,
    total_money_lost_inr: 7600000,
    avg_confidence: 0.62,
    top_crime_types: ["Phishing", "OTP Fraud"],
    last_incident_at: new Date().toISOString(),
    computed_at: new Date().toISOString(),
  },
];

type NeighborOrigin = {
  id: string;
  country: string;
  city: string;
  latitude: number;
  longitude: number;
  risk_score: number;
  patterns: string[];
};

const NEIGHBOR_ORIGINS: NeighborOrigin[] = [
  {
    id: "origin-bangladesh-dhaka",
    country: "Bangladesh",
    city: "Dhaka",
    latitude: 23.8103,
    longitude: 90.4125,
    risk_score: 68,
    patterns: ["Phishing", "OTP fraud", "Fake support calls"],
  },
  {
    id: "origin-pakistan-karachi",
    country: "Pakistan",
    city: "Karachi",
    latitude: 24.8607,
    longitude: 67.0011,
    risk_score: 64,
    patterns: ["Social engineering", "Impersonation calls"],
  },
  {
    id: "origin-nepal-kathmandu",
    country: "Nepal",
    city: "Kathmandu",
    latitude: 27.7172,
    longitude: 85.324,
    risk_score: 46,
    patterns: ["Job fraud", "Payment mule routing"],
  },
  {
    id: "origin-srilanka-colombo",
    country: "Sri Lanka",
    city: "Colombo",
    latitude: 6.9271,
    longitude: 79.8612,
    risk_score: 41,
    patterns: ["Investment lures", "Crypto scam routing"],
  },
];

function riskColor(score: number): string {
  if (score >= 76) return "#B3261E";
  if (score >= 51) return "#DD792C";
  if (score >= 26) return "#C9820A";
  return "#138808";
}

function riskLabel(score: number): string {
  if (score >= 76) return "Critical";
  if (score >= 51) return "High";
  if (score >= 26) return "Medium";
  return "Low";
}

function riskRadius(score: number): number {
  return 7 + (score / 100) * 18;
}

function formatINR(amount: number | null | undefined): string {
  if (!amount) return "No loss data";
  if (amount >= 1e7) return `Rs ${(amount / 1e7).toFixed(1)} Cr`;
  if (amount >= 1e5) return `Rs ${(amount / 1e5).toFixed(1)} L`;
  return `Rs ${amount.toLocaleString("en-IN")}`;
}

function mergeWithWatchlist(liveHotspots: HotspotItem[]): HotspotItem[] {
  const seen = new Set(
    liveHotspots.map((hotspot) => `${hotspot.city.toLowerCase()}|${hotspot.state?.toLowerCase() ?? ""}`)
  );
  const missingWatchlist = INDIAN_WATCHLIST_HOTSPOTS.filter((hotspot) => {
    const key = `${hotspot.city.toLowerCase()}|${hotspot.state?.toLowerCase() ?? ""}`;
    return !seen.has(key);
  });
  return [...liveHotspots, ...missingWatchlist].sort((a, b) => b.risk_score - a.risk_score);
}

export default function RiskMap() {
  const [hotspots, setHotspots] = useState<HotspotItem[]>(INDIAN_WATCHLIST_HOTSPOTS);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingDemo, setUsingDemo] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadRiskData() {
      setLoading(true);
      try {
        const [hotspotData, statsData] = await Promise.all([
          intelligenceApi.getHotspots(),
          intelligenceApi.getStats(),
        ]);

        if (!mounted) return;

        if (hotspotData.items.length > 0) {
          setHotspots(mergeWithWatchlist(hotspotData.items));
          setUsingDemo(false);
        } else {
          setHotspots(INDIAN_WATCHLIST_HOTSPOTS);
          setUsingDemo(true);
        }
        setStats(statsData);
      } catch {
        if (!mounted) return;
        setHotspots(INDIAN_WATCHLIST_HOTSPOTS);
        setUsingDemo(true);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadRiskData();
    return () => {
      mounted = false;
    };
  }, []);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const searchedHotspots = hotspots.filter((hotspot) => {
    if (!normalizedSearch) return true;
    return [hotspot.city, hotspot.district, hotspot.state, hotspot.top_crime_types?.join(" ")]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(normalizedSearch));
  });
  const topHotspots = searchedHotspots
    .filter((hotspot) => hotspot.latitude && hotspot.longitude)
    .slice(0, 12);
  const totalEvents = stats?.total_events ?? hotspots.reduce((sum, h) => sum + h.incident_count, 0);
  const monthEvents =
    stats?.total_events_last_30_days ?? hotspots.reduce((sum, h) => sum + h.recent_incident_count, 0);
  const liveCount = usingDemo ? 0 : stats?.pipeline.total_hotspots_computed ?? 0;

  return (
    <Layout>
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Threat intelligence</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">Risk map</h1>
        <p className="mt-1 text-sm text-muted">
          Live city hotspots, plus a regional watchlist for nearby cross-border cybercrime activity.
        </p>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="card p-3">
          <div className="flex items-center gap-2 text-navy">
            <ShieldIcon className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase">Incidents</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-ink">{totalEvents.toLocaleString("en-IN")}</p>
          <p className="text-xs text-muted">{monthEvents.toLocaleString("en-IN")} in 30 days</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2 text-navy">
            <MapPinIcon className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase">Hotspots</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-ink">{hotspots.length}</p>
          <p className="text-xs text-muted">
            {usingDemo ? "Watchlist preview" : `${liveCount} live + watchlist`}
          </p>
        </div>
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          Search city
        </label>
        <div className="relative">
          <input
            className="input pr-10"
            placeholder="Try Delhi, Pune, Kolkata..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {searchQuery && (
            <button
              aria-label="Clear city search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted"
              onClick={() => setSearchQuery("")}
              type="button"
            >
              x
            </button>
          )}
        </div>
      </div>

      <div className="risk-map-container">
        <MapContainer center={INDIA_CENTER} zoom={INDIA_ZOOM} className="leaflet-container" zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {topHotspots.map((hotspot) => (
            <CircleMarker
              key={hotspot.id}
              center={[hotspot.latitude as number, hotspot.longitude as number]}
              radius={riskRadius(hotspot.risk_score)}
              pathOptions={{
                color: riskColor(hotspot.risk_score),
                fillColor: riskColor(hotspot.risk_score),
                fillOpacity: 0.28,
                opacity: 0.9,
                weight: 2,
              }}
            >
              <Tooltip direction="top">{hotspot.city}</Tooltip>
              <Popup>
                <div>
                  <p className="hotspot-popup-city">{hotspot.city}</p>
                  <p className="hotspot-popup-state">{hotspot.state}</p>
                  <span
                    className="hotspot-popup-risk"
                    style={{ background: riskColor(hotspot.risk_score) }}
                  >
                    {riskLabel(hotspot.risk_score)} risk
                  </span>
                  <div className="hotspot-popup-row">
                    <span>Recent reports</span>
                    <strong>{hotspot.recent_incident_count}</strong>
                  </div>
                  <div className="hotspot-popup-row">
                    <span>Money lost</span>
                    <strong>{formatINR(hotspot.total_money_lost_inr)}</strong>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
          {NEIGHBOR_ORIGINS.map((origin) => (
            <CircleMarker
              key={origin.id}
              center={[origin.latitude, origin.longitude]}
              radius={riskRadius(origin.risk_score) * 0.78}
              pathOptions={{
                color: "#4B260F",
                fillColor: "#4B260F",
                fillOpacity: 0.22,
                opacity: 0.85,
                dashArray: "4 4",
                weight: 2,
              }}
            >
              <Tooltip direction="top">{origin.country}</Tooltip>
              <Popup>
                <div>
                  <p className="hotspot-popup-city">{origin.city}</p>
                  <p className="hotspot-popup-state">{origin.country} origin watch</p>
                  <span className="hotspot-popup-risk" style={{ background: "#4B260F" }}>
                    Regional signal
                  </span>
                  <div className="hotspot-popup-row">
                    <span>Risk signal</span>
                    <strong>{origin.risk_score}/100</strong>
                  </div>
                  <div className="hotspot-popup-crimes">
                    {origin.patterns.map((pattern) => (
                      <span className="hotspot-popup-tag" key={pattern}>
                        {pattern}
                      </span>
                    ))}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 text-xs text-muted">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-highrisk" />
          Indian city hotspot
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-navy" />
          Neighbor origin signal
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">
          {normalizedSearch ? "Search results" : "Current hotspots"}
        </h2>
        {loading && <span className="text-xs text-muted">Updating...</span>}
      </div>

      <div className="risk-hotspot-list">
        {topHotspots.length > 0 ? (
          topHotspots.map((hotspot) => (
            <div className="risk-hotspot-item" key={hotspot.id}>
              <span className="risk-hotspot-dot" style={{ background: riskColor(hotspot.risk_score) }} />
              <div className="risk-hotspot-info">
                <p className="risk-hotspot-city">{hotspot.city}</p>
                <p className="risk-hotspot-meta">
                  {[hotspot.state, hotspot.top_crime_types?.slice(0, 2).join(", ")]
                    .filter(Boolean)
                    .join(" - ")}
                </p>
              </div>
              <span className="risk-hotspot-score" style={{ background: riskColor(hotspot.risk_score) }}>
                {Math.round(hotspot.risk_score)}
              </span>
            </div>
          ))
        ) : (
          <div className="card text-sm text-muted">
            No hotspot found for "{searchQuery}". Try a nearby city or state.
          </div>
        )}
      </div>

      <h2 className="mb-3 mt-5 text-sm font-semibold text-ink">Neighboring origin signals</h2>
      <div className="risk-hotspot-list">
        {NEIGHBOR_ORIGINS.map((origin) => (
          <div className="risk-hotspot-item" key={origin.id}>
            <span className="risk-hotspot-dot" style={{ background: "#4B260F" }} />
            <div className="risk-hotspot-info">
              <p className="risk-hotspot-city">{origin.country}</p>
              <p className="risk-hotspot-meta">
                {[origin.city, origin.patterns.slice(0, 2).join(", ")].join(" - ")}
              </p>
            </div>
            <span className="risk-hotspot-score" style={{ background: "#4B260F" }}>
              {origin.risk_score}
            </span>
          </div>
        ))}
      </div>
    </Layout>
  );
}
