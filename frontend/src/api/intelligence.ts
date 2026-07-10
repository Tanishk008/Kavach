/**
 * Intelligence pipeline API client.
 * Connects to the /intelligence/* endpoints.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export interface CrimeEvent {
  id: string;
  title: string | null;
  summary: string | null;
  crime_type: string | null;
  subcategory: string | null;
  incident_date: string | null;
  state: string | null;
  district: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  money_lost_inr: number | null;
  victim_count: number | null;
  suspect_count: number | null;
  source_name: string | null;
  source_url: string | null;
  confidence: number | null;
  severity_score: number | null;
  created_at: string;
}

export interface CrimeEventList {
  total: number;
  limit: number;
  offset: number;
  items: CrimeEvent[];
}

export interface HotspotItem {
  id: string;
  city: string;
  district: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  risk_score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  incident_count: number;
  recent_incident_count: number;
  total_money_lost_inr: number;
  avg_confidence: number | null;
  top_crime_types: string[] | null;
  last_incident_at: string | null;
  computed_at: string;
}

export interface HotspotList {
  total: number;
  items: HotspotItem[];
}

export interface CrimeTypeCount {
  crime_type: string;
  count: number;
  total_money_lost_inr: number;
}

export interface StateCount {
  state: string;
  count: number;
  risk_score: number;
}

export interface PipelineStatus {
  last_run_at: string | null;
  last_run_status: string | null;
  total_articles_collected: number;
  total_events_geocoded: number;
  total_hotspots_computed: number;
  scheduler_running: boolean;
}

export interface StatsData {
  total_events: number;
  total_events_last_30_days: number;
  total_money_lost_inr: number;
  total_victims: number;
  top_crime_types: CrimeTypeCount[];
  top_states: StateCount[];
  most_recent_incident: string | null;
  pipeline: PipelineStatus;
}

export interface EventFilters {
  state?: string;
  district?: string;
  city?: string;
  crime_type?: string;
  date_from?: string;
  date_to?: string;
  min_money_lost?: number;
  has_coordinates?: boolean;
  limit?: number;
  offset?: number;
}

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, v);
      }
    });
  }
  const resp = await fetch(url.toString());
  if (!resp.ok) {
    throw new Error(`API error ${resp.status}: ${resp.statusText}`);
  }
  return resp.json() as Promise<T>;
}

export const intelligenceApi = {
  getEvents: (filters: EventFilters = {}) => {
    const params: Record<string, string> = {};
    if (filters.state) params.state = filters.state;
    if (filters.district) params.district = filters.district;
    if (filters.city) params.city = filters.city;
    if (filters.crime_type) params.crime_type = filters.crime_type;
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to) params.date_to = filters.date_to;
    if (filters.min_money_lost !== undefined) params.min_money_lost = String(filters.min_money_lost);
    if (filters.has_coordinates !== undefined) params.has_coordinates = String(filters.has_coordinates);
    params.limit = String(filters.limit || 100);
    params.offset = String(filters.offset || 0);
    return apiFetch<CrimeEventList>("/intelligence/events", params);
  },

  getEvent: (id: string) => apiFetch<CrimeEvent>(`/intelligence/events/${id}`),

  getHotspots: (filters: { state?: string; risk_level?: string; min_risk_score?: number } = {}) => {
    const params: Record<string, string> = {};
    if (filters.state) params.state = filters.state;
    if (filters.risk_level) params.risk_level = filters.risk_level;
    if (filters.min_risk_score !== undefined) params.min_risk_score = String(filters.min_risk_score);
    params.limit = "500";
    return apiFetch<HotspotList>("/intelligence/hotspots", params);
  },

  getStats: () => apiFetch<StatsData>("/intelligence/stats"),

  search: (q: string, limit = 20) =>
    apiFetch<{ query: string; total: number; items: CrimeEvent[] }>("/intelligence/search", {
      q,
      limit: String(limit),
    }),

  triggerPipeline: async () => {
    const resp = await fetch(`${BASE_URL}/intelligence/pipeline/run`, { method: "POST" });
    if (!resp.ok) throw new Error(`Pipeline trigger failed: ${resp.status}`);
    return resp.json();
  },
};
