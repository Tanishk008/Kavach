import type { Tier } from "../theme/tokens";
export type { Tier };

export interface PlaybookStep {
  order: number;
  text: string;
}
export interface Playbook {
  id: string;
  title: string;
  steps: PlaybookStep[];
}
export interface VoiceSignal {
  deepfake_likelihood: string;
  note: string;
}
export interface UrlFinding {
  url: string;
  risk_score: number;
  signals: string[];
}
export interface Extracted {
  urls: UrlFinding[];
  keywords: string[];
  phone_numbers: string[];
}
export interface ClassifyResponse {
  tier: Tier;
  confidence: number;
  scam_type: string | null;
  reasons: string[];
  playbook: Playbook | null;
  voice_signal: VoiceSignal | null;
  event_id: string | null;
  // Deterministic backend enrichment
  risk_score: number;
  extracted: Extracted;
}

export type NumberVerdict =
  | "verified"
  | "reported_scam"
  | "high_risk_pattern"
  | "unwanted_not_confirmed"
  | "unknown_neutral";

export interface CategoryBreakdown {
  category: string;
  label: string;
  count: number;
  pct: number;
}

export interface NumberCheckResponse {
  number: string;
  verdict: NumberVerdict;
  institution: string | null;
  report_count: number;
  top_categories: string[];
  explanation: string;
  tips: string[];
  // Deterministic backend enrichment — see backend/app/core/number_meta.py
  number_type: string; // mobile | service_1600 | promotional | toll_free | unknown
  is_valid_shape: boolean;
  country: string | null;
  circle: string | null;       // original allocation circle (India mobile only)
  circle_note: string | null;  // MNP caveat, present alongside `circle`
  is_verified_service: boolean;
  special_series: string | null;
  risk_score: number;
  category_breakdown: CategoryBreakdown[];
}

export interface PayCheckResponse {
  identifier: string;
  flagged: boolean;
  report_count: number;
  cluster_ref: string | null;
  cluster_victim_count: number | null;
  explanation: string;
}

export interface CurrencyCheckResponse {
  denomination: string | null;
  authenticity: string;
  confidence: number;
  features_checked: string[];
  message: string;
}
