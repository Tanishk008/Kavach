import Layout from "../components/Layout";
import BackHeader from "../components/BackHeader";
import { HeadsetIcon, MessageIcon, PhoneIcon, SearchIcon } from "../components/Icons";

const redFlags = [
  "Someone says you are under digital arrest or cannot disconnect the call.",
  "They ask you to keep the call secret from family, bank staff, or police.",
  "They demand OTP, UPI PIN, card details, screen sharing, remote access, or urgent payment.",
  "They send fake ID cards, FIRs, court notices, courier notices, or police-style letters on chat.",
  "They threaten arrest, account freeze, parcel seizure, or public embarrassment if you delay.",
];

const digitalArrestSteps = [
  "Disconnect the call. Real police or government officers do not keep citizens on video call as digital arrest.",
  "Do not transfer money, share OTPs, install apps, or turn on screen sharing.",
  "Call a trusted family member or emergency contact from a different conversation thread.",
  "Use Kavach to check the number, pasted message, payment detail, or uploaded voice recording.",
  "If money was sent, call 1930 immediately and collect screenshots, transaction IDs, phone numbers, and chat links.",
];

const kavachChecks = [
  {
    title: "Before answering pressure",
    text: "Use number check when a caller claims to be from police, bank, courier, customs, court, CBI, ED, or telecom support.",
    icon: <PhoneIcon className="h-5 w-5" />,
  },
  {
    title: "Before believing a message",
    text: "Paste the message or suspicious link into Kavach. Look for the verdict and the reasons, not just the color.",
    icon: <MessageIcon className="h-5 w-5" />,
  },
  {
    title: "Before paying anyone",
    text: "Search the UPI ID, account detail, or phone number. A clean result means no known red flags, not guaranteed safety.",
    icon: <SearchIcon className="h-5 w-5" />,
  },
  {
    title: "Before trusting a voice clip",
    text: "Upload the recording if a caller sounds like a relative, officer, or executive but is asking for secrecy or money.",
    icon: <HeadsetIcon className="h-5 w-5" />,
  },
];

const evidenceItems = [
  "Phone numbers and caller names",
  "Screenshots of chats, notices, QR codes, and payment requests",
  "UPI IDs, account numbers, transaction IDs, and timestamps",
  "Voice recordings or call clips, if safely available",
  "Links, app names, APK files, or remote-access app names mentioned by the caller",
];

export default function SafetyTips() {
  return (
    <Layout>
      <BackHeader title="Safety Tips" subtitle="A quick action guide when something feels urgent" />
      <section className="mb-4">
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted">
          Scam red flags
        </p>
        <div className="card space-y-3">
          {redFlags.map((flag) => (
            <div className="flex gap-2" key={flag}>
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-highrisk" />
              <p className="text-sm leading-relaxed text-muted">{flag}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-4">
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted">
          If someone says digital arrest
        </p>
        <div className="card">
          <ol className="space-y-3">
            {digitalArrestSteps.map((step, index) => (
              <li className="flex gap-3" key={step}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-highrisk text-xs font-bold text-white">
                  {index + 1}
                </span>
                <p className="text-sm leading-relaxed text-muted">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mb-4">
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted">
          How to use Kavach safely
        </p>
        <div className="space-y-3">
          {kavachChecks.map((item) => (
            <div className="card flex gap-3" key={item.title}>
              <div className="mt-0.5 text-navy">{item.icon}</div>
              <div>
                <h2 className="text-sm font-semibold text-ink">{item.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-4">
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted">
          Save evidence
        </p>
        <div className="card space-y-3">
          {evidenceItems.map((item) => (
            <div className="flex gap-2" key={item}>
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-india" />
              <p className="text-sm leading-relaxed text-muted">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <div className="card border-highrisk/30 bg-highrisk-bg">
          <h2 className="text-base font-semibold text-highrisk">Emergency rule</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink">
            If money has already been transferred, call 1930 as quickly as possible. Faster reporting
            improves the chance of freezing the transaction trail.
          </p>
          <a href="tel:1930" className="btn-primary mt-4">
            Call 1930
          </a>
        </div>
      </section>
    </Layout>
  );
}
