// Per-domain API modules — one call site per backend endpoint.
import { api } from "./client";
import type {
  ClassifyResponse,
  CurrencyCheckResponse,
  NumberCheckResponse,
  PayCheckResponse,
} from "./types";

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
};

export const currency = {
  check: (file: File) => {
    const form = new FormData();
    form.append("image", file);
    return api.postForm<CurrencyCheckResponse>("/api/currency/check", form);
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
