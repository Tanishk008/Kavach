import { useState } from "react";
import Layout from "../components/Layout";
import BackHeader from "../components/BackHeader";

// The Twilio Sandbox WhatsApp number — replace with your real bot number before going live
const WHATSAPP_BOT_NUMBER = "14155238886"; // without +
const WHATSAPP_JOIN_MESSAGE = "Hi Kavach";

function openWhatsApp() {
  const url = `https://wa.me/${WHATSAPP_BOT_NUMBER}?text=${encodeURIComponent(WHATSAPP_JOIN_MESSAGE)}`;
  window.open(url, "_blank");
}

const CAPABILITIES = [
  {
    title: "Scan Suspicious Texts",
    desc: "Forward any SMS, message, or link — we'll tell you instantly if it's a scam.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    title: "Screenshot Analysis",
    desc: "Send a photo or screenshot of a suspicious message — our OCR will read and classify it.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: "Voice Note Detection",
    desc: "Forward a suspicious voice note — our AI detects deepfakes and AI-generated audio.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  {
    title: "Instant Verdict",
    desc: "Get a clear Safe / Caution / High Risk verdict with actionable steps in seconds.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
];

const STEPS = [
  { num: "1", title: "Tap the button below", desc: "Opens WhatsApp with the message pre-filled." },
  { num: "2", title: "Send \"Hi Kavach\"", desc: "The bot activates instantly and guides you." },
  { num: "3", title: "Forward anything suspicious", desc: "Text, screenshot, or voice note — the bot handles all." },
];

export default function WhatsAppBot() {
  const [copied, setCopied] = useState(false);

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(`+${WHATSAPP_BOT_NUMBER}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <Layout>
      <BackHeader
        title="WhatsApp Bot"
        subtitle="Kavach protection, right inside WhatsApp"
      />

      {/* Hero card */}
      <div
        className="card mb-4 overflow-hidden relative"
        style={{
          background: "linear-gradient(135deg, #075E54 0%, #128C7E 50%, #25D366 100%)",
          border: "none",
        }}
      >
        <div className="absolute inset-0 opacity-10">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <circle cx="160" cy="40" r="80" fill="white" />
            <circle cx="30" cy="170" r="60" fill="white" />
          </svg>
        </div>
        <div className="relative z-10 flex items-center gap-4 p-2">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
            {/* WhatsApp icon */}
            <svg className="w-9 h-9 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <div className="text-white">
            <h2 className="text-lg font-bold">Kavach on WhatsApp</h2>
            <p className="text-sm text-white/80 mt-0.5">
              Scan scams directly from your WhatsApp chats
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-4">
          <button
            onClick={openWhatsApp}
            className="w-full flex items-center justify-center gap-3 rounded-xl bg-white py-3.5 text-base font-bold transition active:scale-[0.98]"
            style={{ color: "#075E54" }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Add Kavach Bot on WhatsApp
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="card mb-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted">How to connect</p>
        <div className="space-y-3">
          {STEPS.map((step) => (
            <div key={step.num} className="flex items-start gap-3">
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
                style={{ background: "#25D366" }}
              >
                {step.num}
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{step.title}</p>
                <p className="text-xs text-muted mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Capabilities */}
      <div className="card mb-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted">What the bot can do</p>
        <div className="space-y-3">
          {CAPABILITIES.map((cap) => (
            <div key={cap.title} className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-canvas text-navy">
                {cap.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{cap.title}</p>
                <p className="text-xs text-muted mt-0.5">{cap.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Manual number copy */}
      <div className="card mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Bot Number</p>
          <p className="mt-1 text-base font-bold text-ink tracking-wide">+{WHATSAPP_BOT_NUMBER}</p>
          <p className="text-xs text-muted">Save this number to use on WhatsApp</p>
        </div>
        <button
          onClick={copyNumber}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-hairline bg-canvas px-3 py-2 text-xs font-semibold text-ink transition hover:bg-surface active:scale-95"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-safe" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {/* Privacy note */}
      <div className="rounded-card border border-hairline bg-canvas px-4 py-3 mb-4">
        <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1">Privacy Note</p>
        <p className="text-xs text-muted leading-relaxed">
          Messages you forward to Kavach Bot are analysed by our backend and immediately discarded.
          We do not store or share the content of your WhatsApp conversations.
          Your phone number is used only to link your Kavach account.
        </p>
      </div>
    </Layout>
  );
}
