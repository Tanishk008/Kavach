import type { Tier } from "../theme/tokens";
export type { Tier };

export interface OcrResponse {
  extracted_text: string;
}

// ── User & History Types ────────────────────────────────────────────────────
export interface UserEvent {
  id: string;
  input_type: string;
  tier: "safe" | "caution" | "high_risk";
  created_at: string;
  content_excerpt?: string;
  scam_type?: string;
}

export interface ScoreResponse {
  score: number;
}

export interface LiveAlert {
  id: string;
  scam_type: string;
  region_city: string;
  created_at: string;
}

export interface OCRExtractResponse {
  text: string;
  lines: string[];
  confidence: number;
}

export interface BotAction {
  label: string;
  route: string;
}

export interface BotChatRequest {
  message: string;
}

export interface BotChatResponse {
  response: string;
  actions: BotAction[];
}



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
  identifier_type: "upi" | "phone" | "account" | "unknown";
  flagged: boolean;
  report_count: number;
  cluster_ref: string | null;
  cluster_victim_count: number | null;
  explanation: string;
  // UPI enrichment
  dataset_flagged: boolean;
  upi_handle_trust: string | null;  // verified | unverified | null
  upi_institution: string | null;   // Bank/app name if handle verified
  pattern_score: number;            // 0-100
  pattern_signals: string[];        // Suspicious keyword matches
  risk_score: number;               // 0-100
  verdict: string;                  // safe | suspicious | flagged
  tips: string[];
  raw_records: string[];
  emergency_contacts: Array<{ label: string; value: string; action: string }>;
}

export interface FraudDirectoryPreview {
  counts: Record<"upi" | "phone" | "account", number>;
  samples: Record<"upi" | "phone" | "account", string[]>;
}

export interface VoiceAnalysisResponse {
  verdict: "human" | "ai_generated" | "uncertain";
  confidence: number;
  signals: string[];
  advice: string;
  duration_seconds: number | null;
  processing_note: string | null;
}

export interface CurrencyCheckResponse {
  denomination: string | null;
  authenticity: string;
  confidence: number;
  features_checked: string[];
  message: string;
}
