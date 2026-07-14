// Per-domain API modules — one call site per backend endpoint.
import { api } from "./client";
import type {
  ClassifyResponse,
  CurrencyCheckResponse,
  FraudDirectoryPreview,
  NumberCheckResponse,
  PayCheckResponse,
  VoiceAnalysisResponse,
  OCRExtractResponse,
  BotChatResponse,
  LiveAlert,
  UserEvent,
  ScoreResponse,
} from "./types";

export const feed = {
  getAlerts: () => api.get<LiveAlert[]>("/api/feed/alerts"),
};

export const users = {
  getEvents: (phone?: string) => api.get<UserEvent[]>(`/api/users/me/events?phone=${phone || localStorage.getItem("kavach_phone") || ""}`),
  getScore: (phone?: string) => api.get<ScoreResponse>(`/api/users/me/score?phone=${phone || localStorage.getItem("kavach_phone") || ""}`),
  incrementScore: (points: number, phone?: string) => api.post<ScoreResponse>(`/api/users/me/score?phone=${phone || localStorage.getItem("kavach_phone") || ""}`, { points }),
};

export const bot = {
  chat: (message: string) => api.post<BotChatResponse>("/api/bot/chat", { message }),
};

export const ocr = {
  extract: (file: File) => {
    const form = new FormData();
    form.append("image", file);
    return api.postForm<OCRExtractResponse>("/api/ocr/extract", form);
  },
};

export const messages = {
  classify: (text: string, extra: Partial<{ input_type: string; voice_deepfake_likelihood: string }> = {}) =>
    api.post<ClassifyResponse>("/api/messages/classify", { text, channel: "app", input_type: "text", ...extra }),
};

export const numbers = {
  check: (number: string) => api.post<NumberCheckResponse>("/api/numbers/check", { number }),
  report: (identifier: string, category: string, identifier_type = "phone") =>
    api.post("/api/reports", { identifier, category, identifier_type }),
};

export const pay = {
  check: (identifier: string) => api.post<PayCheckResponse>("/api/pay/check", { identifier }),
  directory: () => api.get<FraudDirectoryPreview>("/api/pay/directory"),
};

export const currency = {
  check: (file: File) => {
    const form = new FormData();
    form.append("image", file);
    return api.postForm<CurrencyCheckResponse>("/api/currency/check", form);
  },
};

export const voice = {
  analyze: (file: File) => {
    const form = new FormData();
    form.append("audio", file);
    return api.postForm<VoiceAnalysisResponse>("/api/voice/analyze", form);
  },
};

export const auth = {
  sendOtp: (phone_number: string) =>
    api.post<{ phone_number: string; resend_after_seconds: number }>("/api/auth/send-otp", { phone_number }),
  verifyOtp: (phone_number: string, code: string) =>
    api.post<{ user_id: string; session_token: string; onboarding_complete: boolean }>(
      "/api/auth/verify-otp",
      { phone_number, code }
    ),
};
