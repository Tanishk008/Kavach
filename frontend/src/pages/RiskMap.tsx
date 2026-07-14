import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { intelligenceApi, type HotspotItem, type StatsData } from "../api/intelligence";
import Layout from "../components/Layout";
import BackHeader from "../components/BackHeader";
import { MapPinIcon, ShieldIcon } from "../components/Icons";

const INDIA_CENTER: [number, number] = [23.5, 78.8];
const INDIA_ZOOM = 4.55;
const INDIA_BOUNDS: [[number, number], [number, number]] = [[5.5, 66.0], [36.8, 98.5]];

const INDIAN_WATCHLIST_HOTSPOTS: HotspotItem[] = [
  { id: "demo-delhi",      city: "Delhi",     district: null, state: "Delhi",       latitude: 28.6139, longitude: 77.209,  risk_score: 88, risk_level: "critical", incident_count: 142, recent_incident_count: 48, total_money_lost_inr: 85000000,  avg_confidence: 0.78, top_crime_types: ["Digital Arrest", "UPI Scam"],           last_incident_at: new Date().toISOString(), computed_at: new Date().toISOString() },
  { id: "demo-mumbai",     city: "Mumbai",    district: null, state: "Maharashtra", latitude: 19.076,  longitude: 72.8777, risk_score: 79, risk_level: "critical", incident_count: 118, recent_incident_count: 41, total_money_lost_inr: 124000000, avg_confidence: 0.82, top_crime_types: ["Investment Scam", "Banking Fraud"],       last_incident_at: new Date().toISOString(), computed_at: new Date().toISOString() },
  { id: "demo-bengaluru",  city: "Bengaluru", district: null, state: "Karnataka",   latitude: 12.9716, longitude: 77.5946, risk_score: 72, risk_level: "high",     incident_count: 95,  recent_incident_count: 33, total_money_lost_inr: 67000000,  avg_confidence: 0.75, top_crime_types: ["Phishing", "OTP Fraud"],                last_incident_at: new Date().toISOString(), computed_at: new Date().toISOString() },
  { id: "demo-hyderabad",  city: "Hyderabad", district: null, state: "Telangana",   latitude: 17.385,  longitude: 78.4867, risk_score: 65, risk_level: "high",     incident_count: 72,  recent_incident_count: 26, total_money_lost_inr: 43000000,  avg_confidence: 0.71, top_crime_types: ["UPI Scam", "WhatsApp Scam"],            last_incident_at: new Date().toISOString(), computed_at: new Date().toISOString() },
  { id: "demo-ahmedabad",  city: "Ahmedabad", district: null, state: "Gujarat",     latitude: 23.0225, longitude: 72.5714, risk_score: 58, risk_level: "high",     incident_count: 61,  recent_incident_count: 22, total_money_lost_inr: 38000000,  avg_confidence: 0.69, top_crime_types: ["Loan App Fraud", "Investment Scam"],   last_incident_at: new Date().toISOString(), computed_at: new Date().toISOString() },
  { id: "demo-jaipur",     city: "Jaipur",    district: null, state: "Rajasthan",   latitude: 26.9124, longitude: 75.7873, risk_score: 52, risk_level: "high",     incident_count: 54,  recent_incident_count: 19, total_money_lost_inr: 31000000,  avg_confidence: 0.67, top_crime_types: ["Digital Arrest", "OTP Fraud"],          last_incident_at: new Date().toISOString(), computed_at: new Date().toISOString() },
  { id: "demo-pune",       city: "Pune",      district: null, state: "Maharashtra", latitude: 18.5204, longitude: 73.8567, risk_score: 47, risk_level: "medium",   incident_count: 48,  recent_incident_count: 17, total_money_lost_inr: 25000000,  avg_confidence: 0.73, top_crime_types: ["Crypto Scam", "Phishing"],              last_incident_at: new Date().toISOString(), computed_at: new Date().toISOString() },
  { id: "demo-chennai",    city: "Chennai",   district: null, state: "Tamil Nadu",  latitude: 13.0827, longitude: 80.2707, risk_score: 43, risk_level: "medium",   incident_count: 42,  recent_incident_count: 15, total_money_lost_inr: 19000000,  avg_confidence: 0.70, top_crime_types: ["Vishing", "Credit Card Fraud"],         last_incident_at: new Date().toISOString(), computed_at: new Date().toISOString() },
  { id: "demo-kolkata",    city: "Kolkata",   district: null, state: "West Bengal", latitude: 22.5726, longitude: 88.3639, risk_score: 39, risk_level: "medium",   incident_count: 31,  recent_incident_count: 10, total_money_lost_inr: 11000000,  avg_confidence: 0.63, top_crime_types: ["WhatsApp Scam", "Loan App Fraud"],      last_incident_at: new Date().toISOString(), computed_at: new Date().toISOString() },
  { id: "demo-guwahati",   city: "Guwahati",  district: null, state: "Assam",       latitude: 26.1445, longitude: 91.7362, risk_score: 34, risk_level: "medium",   incident_count: 24,  recent_incident_count: 8,  total_money_lost_inr: 7600000,   avg_confidence: 0.62, top_crime_types: ["Phishing", "OTP Fraud"],                last_incident_at: new Date().toISOString(), computed_at: new Date().toISOString() },
];

type NeighborOrigin = {
  id: string; country: string; city: string;
  latitude: number; longitude: number;
  risk_score: number; patterns: string[];
};

const NEIGHBOR_ORIGINS: NeighborOrigin[] = [
  { id: "origin-bangladesh-dhaka",   country: "Bangladesh", city: "Dhaka",    latitude: 23.8103, longitude: 90.4125, risk_score: 68, patterns: ["Phishing", "OTP fraud", "Fake support calls"] },
  { id: "origin-pakistan-karachi",   country: "Pakistan",   city: "Karachi",  latitude: 24.8607, longitude: 67.0011, risk_score: 64, patterns: ["Social engineering", "Impersonation calls"] },
  { id: "origin-nepal-kathmandu",    country: "Nepal",      city: "Kathmandu",latitude: 27.7172, longitude: 85.324,  risk_score: 46, patterns: ["Job fraud", "Payment mule routing"] },
  { id: "origin-srilanka-colombo",   country: "Sri Lanka",  city: "Colombo",  latitude:  6.9271, longitude: 79.8612, risk_score: 41, patterns: ["Investment lures", "Crypto scam routing"] },
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
  if (!amount) return "No data";
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(1)} Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(1)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}
function mergeWithWatchlist(liveHotspots: HotspotItem[]): HotspotItem[] {
  const seen = new Set(liveHotspots.map((h) => `${h.city.toLowerCase()}|${h.state?.toLowerCase() ?? ""}`));
  const missing = INDIAN_WATCHLIST_HOTSPOTS.filter((h) => !seen.has(`${h.city.toLowerCase()}|${h.state?.toLowerCase() ?? ""}`));
  return [...liveHotspots, ...missing].sort((a, b) => b.risk_score - a.risk_score);
}

type FilterTab = "all" | "critical" | "high" | "medium";

const FILTER_TABS: { key: FilterTab; label: string; color: string }[] = [
  { key: "all",      label: "All",      color: "text-ink" },
  { key: "critical", label: "Critical", color: "text-highrisk" },
  { key: "high",     label: "High",     color: "text-caution" },
  { key: "medium",   label: "Medium",   color: "text-[#C9820A]" },
];

function hotspotMatchesSearch(hotspot: HotspotItem, query: string): boolean {
  if (!query) return false;
  return [hotspot.city, hotspot.district, hotspot.state]
    .filter(Boolean)
    .some((value) => value?.toLowerCase().includes(query));
}

function MapController({ hotspots, query }: { hotspots: HotspotItem[]; query: string }) {
  const map = useMap();

  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 80);
    const coords = hotspots
      .filter((h) => h.latitude && h.longitude)
      .map((h) => [h.latitude as number, h.longitude as number] as [number, number]);

    const exact = hotspots.find((h) => hotspotMatchesSearch(h, query) && h.latitude && h.longitude);
    if (exact) {
      map.setView([exact.latitude as number, exact.longitude as number], 6.8, { animate: true });
      return;
    }

    if (coords.length === 1) {
      map.setView(coords[0], 6.2, { animate: true });
      return;
    }

    if (coords.length > 1) {
      map.fitBounds(coords, { padding: [28, 28], maxZoom: 6.2, animate: true });
      return;
    }

    map.fitBounds(INDIA_BOUNDS, { padding: [14, 14], animate: true });
  }, [hotspots, map, query]);

  return null;
}

export default function RiskMap() {
  const [hotspots, setHotspots] = useState<HotspotItem[]>(INDIAN_WATCHLIST_HOTSPOTS);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingDemo, setUsingDemo] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");

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
    return () => { mounted = false; };
  }, []);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredByTab = hotspots.filter((h) => {
    if (filterTab === "all") return true;
    if (filterTab === "critical") return h.risk_score >= 76;
    if (filterTab === "high") return h.risk_score >= 51 && h.risk_score < 76;
    if (filterTab === "medium") return h.risk_score >= 26 && h.risk_score < 51;
    return true;
  });

  const searchedHotspots = filteredByTab.filter((h) => {
    if (!normalizedSearch) return true;
    return [h.city, h.district, h.state, h.top_crime_types?.join(" ")]
      .filter(Boolean)
      .some((v) => v?.toLowerCase().includes(normalizedSearch));
  });

  const mapHotspots = searchedHotspots.filter((h) => h.latitude && h.longitude).slice(0, 12);
  const totalEvents = stats?.total_events ?? hotspots.reduce((s, h) => s + h.incident_count, 0);
  const monthEvents = stats?.total_events_last_30_days ?? hotspots.reduce((s, h) => s + h.recent_incident_count, 0);
  const totalLost = hotspots.reduce((s, h) => s + (h.total_money_lost_inr ?? 0), 0);
  const liveCount = usingDemo ? 0 : stats?.pipeline.total_hotspots_computed ?? 0;

  return (
    <Layout>
      <BackHeader
        title="Risk Map"
        subtitle="Live city hotspots & cross-border fraud activity"
        badge={
          usingDemo
            ? <span className="rounded-full bg-caution/10 px-2 py-0.5 text-[10px] font-bold text-caution border border-caution/20">WATCHLIST</span>
            : <span className="rounded-full bg-safe/10 px-2 py-0.5 text-[10px] font-bold text-safe border border-safe/20">LIVE</span>
        }
      />

      {/* Stats strip */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        {[
          { icon: <ShieldIcon className="h-4 w-4" />, label: "Incidents", value: totalEvents.toLocaleString("en-IN"), sub: `${monthEvents.toLocaleString("en-IN")} this month` },
          { icon: <MapPinIcon className="h-4 w-4" />, label: "Hotspots", value: String(hotspots.length), sub: usingDemo ? "Watchlist" : `${liveCount} live` },
          { icon: <span className="text-base"></span>, label: "Total Lost", value: formatINR(totalLost), sub: "Across all hotspots" },
        ].map((stat, i) => (
          <div key={i} className="rounded-card border border-hairline bg-surface p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 text-navy mb-1">{stat.icon}</div>
            <p className="text-base font-bold text-ink leading-tight">{stat.value}</p>
            <p className="text-[9px] text-muted uppercase tracking-wide mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mb-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="input pl-9 pr-9"
            placeholder="Search city, state or crime type…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted hover:text-ink"
              onClick={() => setSearchQuery("")}
              type="button"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-3 flex gap-1 rounded-card border border-hairline bg-canvas p-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterTab(tab.key)}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
              filterTab === tab.key ? "bg-navy text-white shadow-sm" : `${tab.color} hover:bg-surface`
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Map */}
      <div className="risk-map-container">
        <MapContainer
          center={INDIA_CENTER}
          zoom={INDIA_ZOOM}
          minZoom={4}
          maxZoom={8}
          maxBounds={INDIA_BOUNDS}
          maxBoundsViscosity={0.7}
          className="leaflet-container"
          zoomControl
          scrollWheelZoom={false}
        >
          <MapController hotspots={mapHotspots} query={normalizedSearch} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          {mapHotspots.map((hotspot) => {
            const highlighted = hotspotMatchesSearch(hotspot, normalizedSearch);
            return (
            <CircleMarker
              key={hotspot.id}
              center={[hotspot.latitude as number, hotspot.longitude as number]}
              radius={highlighted ? riskRadius(hotspot.risk_score) + 8 : riskRadius(hotspot.risk_score)}
              pathOptions={{
                color: highlighted ? "#1F130A" : riskColor(hotspot.risk_score),
                fillColor: riskColor(hotspot.risk_score),
                fillOpacity: highlighted ? 0.62 : 0.36,
                opacity: 1,
                weight: highlighted ? 4 : 2,
              }}
            >
              <Tooltip 
                direction="top" 
                permanent={highlighted || hotspot.risk_score > 70} 
                className={`font-semibold bg-white/90 backdrop-blur-sm border-hairline px-2 py-0.5 rounded shadow-sm ${highlighted ? "text-ink border-ink" : "text-navy"}`}
              >
                {hotspot.city}
              </Tooltip>
              <Popup className="premium-popup">
                <div className="min-w-[180px]">
                  <div className="border-b border-hairline pb-2 mb-2">
                    <p className="text-sm font-black text-ink">{hotspot.city}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted">{hotspot.state}</p>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-muted">Risk Level</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white shadow-sm" style={{ background: riskColor(hotspot.risk_score) }}>
                      {riskLabel(hotspot.risk_score)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-muted">Recent Reports</span>
                    <span className="text-xs font-bold text-ink">{hotspot.recent_incident_count}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-muted">Money Lost</span>
                    <span className="text-xs font-bold text-highrisk">{formatINR(hotspot.total_money_lost_inr)}</span>
                  </div>
                  {hotspot.top_crime_types && hotspot.top_crime_types.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-hairline">
                      {hotspot.top_crime_types.map((t) => (
                        <span className="bg-canvas border border-hairline rounded text-[9px] font-bold px-1.5 py-0.5 text-muted" key={t}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );})}
          {filterTab === "all" && !normalizedSearch && NEIGHBOR_ORIGINS.map((origin) => (
            <CircleMarker
              key={origin.id}
              center={[origin.latitude, origin.longitude]}
              radius={riskRadius(origin.risk_score) * 0.78}
              pathOptions={{ color: "#4B260F", fillColor: "#4B260F", fillOpacity: 0.22, opacity: 0.85, dashArray: "4 4", weight: 2 }}
            >
              <Tooltip direction="top">{origin.country}</Tooltip>
              <Popup>
                <div>
                  <p className="hotspot-popup-city">{origin.city}</p>
                  <p className="hotspot-popup-state">{origin.country} — origin watch</p>
                  <span className="hotspot-popup-risk" style={{ background: "#4B260F" }}>Regional signal</span>
                  <div className="hotspot-popup-row"><span>Risk signal</span><strong>{origin.risk_score}/100</strong></div>
                  <div className="hotspot-popup-crimes">
                    {origin.patterns.map((p) => <span className="hotspot-popup-tag" key={p}>{p}</span>)}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-xs text-muted">
        {[
          { color: "#B3261E", label: "Critical hotspot" },
          { color: "#DD792C", label: "High risk" },
          { color: "#C9820A", label: "Medium risk" },
          { color: "#4B260F", label: "Cross-border signal" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>

      {/* Hotspot list */}
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-ink">
          {normalizedSearch ? `Results for "${searchQuery}"` : filterTab === "all" ? "All Hotspots" : `${FILTER_TABS.find(t => t.key === filterTab)?.label} Risk Hotspots`}
        </h2>
        <div className="flex items-center gap-2">
          {loading && <span className="text-xs text-muted">Updating…</span>}
          <span className="text-xs text-muted">{searchedHotspots.length} cities</span>
        </div>
      </div>

      <div className="risk-hotspot-list mb-4">
        {searchedHotspots.length > 0 ? (
          searchedHotspots.map((hotspot) => (
            <div className="risk-hotspot-item" key={hotspot.id}>
              <span className="risk-hotspot-dot" style={{ background: riskColor(hotspot.risk_score) }} />
              <div className="risk-hotspot-info">
                <div className="flex items-baseline gap-2">
                  <p className="risk-hotspot-city">{hotspot.city}</p>
                  <p className="text-[10px] text-muted">{hotspot.state}</p>
                </div>
                <p className="risk-hotspot-meta">
                  {hotspot.top_crime_types?.slice(0, 2).join(" · ")}
                </p>
                <p className="text-[10px] text-muted mt-0.5">
                  {hotspot.recent_incident_count} recent · {formatINR(hotspot.total_money_lost_inr)} lost
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

      {/* Neighbor origins */}
      <h2 className="mb-2 mt-1 text-sm font-semibold text-ink">Neighbouring Origin Signals</h2>
      <div className="risk-hotspot-list">
        {NEIGHBOR_ORIGINS.map((origin) => (
          <div className="risk-hotspot-item" key={origin.id}>
            <span className="risk-hotspot-dot" style={{ background: "#4B260F" }} />
            <div className="risk-hotspot-info">
              <div className="flex items-baseline gap-2">
                <p className="risk-hotspot-city">{origin.country}</p>
                <p className="text-[10px] text-muted">{origin.city}</p>
              </div>
              <p className="risk-hotspot-meta">{origin.patterns.slice(0, 2).join(" · ")}</p>
            </div>
            <span className="risk-hotspot-score" style={{ background: "#4B260F" }}>{origin.risk_score}</span>
          </div>
        ))}
      </div>
    </Layout>
  );
}
