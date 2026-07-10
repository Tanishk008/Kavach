import Layout from "../components/Layout";
import { HeadsetIcon, MapPinIcon, MessageIcon, PhoneIcon, SearchIcon, ShieldIcon } from "../components/Icons";

const coreFeatures = [
  {
    title: "Check a number",
    text: "Look up unknown callers, reported scam numbers, suspicious prefixes, and verified institution numbers before trusting a call.",
    icon: <PhoneIcon className="h-5 w-5" />,
  },
  {
    title: "Check a message",
    text: "Paste suspicious SMS, WhatsApp text, links, or chat content to get a risk verdict with plain-language reasons.",
    icon: <MessageIcon className="h-5 w-5" />,
  },
  {
    title: "Digital arrest voice protection",
    text: "Upload a suspicious voice recording or call clip so Kavach can check the transcript for digital arrest pressure tactics and flag possible voice-cloning risk signals.",
    icon: <HeadsetIcon className="h-5 w-5" />,
  },
  {
    title: "Check before you pay",
    text: "Search a UPI ID, account detail, or phone number before sending money, so users can pause before a scam becomes a loss.",
    icon: <SearchIcon className="h-5 w-5" />,
  },
  {
    title: "Risk map",
    text: "View city-level scam hotspots, regional watch signals, and cybercrime patterns around India and nearby origin zones.",
    icon: <MapPinIcon className="h-5 w-5" />,
  },
];

const protectionFlow = [
  "User checks a call, message, voice recording, payment detail, or currency note.",
  "Kavach extracts useful signals such as phone numbers, links, UPI IDs, scam language, transcript patterns, location, and report history.",
  "The risk engine combines verified registry data, community reports, heuristics, classifier output, and hotspot intelligence.",
  "The app returns a simple verdict: safe, caution, high risk, or verified, with next steps the user can act on immediately.",
  "Confirmed or reported scam signals can feed the shared intelligence layer, improving future warnings for others.",
];

const safeguards = [
  "Approximate location is preferred over precise GPS for hotspot intelligence.",
  "The app explains risk in plain language instead of giving vague technical scores.",
  "Clean results are never shown as a 100 percent guarantee of safety.",
  "Emergency contact alerts are designed as privacy-respecting check-in nudges.",
  "Evidence and report flows are intended to help users escalate to official channels like 1930 or NCRP.",
];

export default function HelplineInfo() {
  return (
    <Layout>
      <section className="mb-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-cream text-navy">
          <ShieldIcon className="h-8 w-8" />
        </div>
        <h1 className="mt-3 text-2xl font-bold text-ink">About Kavach</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Kavach is a digital fraud protection assistant for everyday users. It helps people pause,
          check, and act safely before trusting a call, message, payment request, or suspicious
          situation.
        </p>
      </section>

      <section className="mb-4">
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted">
          What Kavach helps with
        </p>
        <div className="space-y-3">
          {coreFeatures.map((feature) => (
            <div className="card flex gap-3" key={feature.title}>
              <div className="mt-0.5 text-navy">{feature.icon}</div>
              <div>
                <h2 className="text-sm font-semibold text-ink">{feature.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">{feature.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-4">
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted">
          How protection works
        </p>
        <div className="card">
          <ol className="space-y-3">
            {protectionFlow.map((step, index) => (
              <li className="flex gap-3" key={step}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
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
          Intelligence layer
        </p>
        <div className="card space-y-3 text-sm leading-relaxed text-muted">
          <p>
            Kavach is designed around one shared intelligence system. Number checks, message
            classification, suspicious voice recordings, reverse payment checks, reports, and
            hotspot signals all contribute to the same protection layer.
          </p>
          <p>
            This means the app can warn about known scam patterns, repeated identifiers, suspicious
            payment routes, impersonation attempts, and emerging regional trends.
          </p>
        </div>
      </section>

      <section className="mb-4">
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted">
          Safety and privacy principles
        </p>
        <div className="card space-y-3">
          {safeguards.map((item) => (
            <div className="flex gap-2" key={item}>
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-india" />
              <p className="text-sm leading-relaxed text-muted">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-4">
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted">
          Access for everyone
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-3">
            <MessageIcon className="h-6 w-6 text-navy" />
            <h2 className="mt-2 text-sm font-semibold text-ink">In-app checks</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Use the Kavach app to check calls, messages, payments, currency, and hotspot risk.
            </p>
          </div>
          <div className="card p-3">
            <HeadsetIcon className="h-6 w-6 text-navy" />
            <h2 className="mt-2 text-sm font-semibold text-ink">Helpline and IVR</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              A phone-call path can help users without smartphones or reliable data access.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <div className="card text-center">
          <HeadsetIcon className="mx-auto h-10 w-10 text-navy" />
          <h2 className="mt-3 text-lg font-semibold text-ink">Need urgent help?</h2>
          <p className="mt-1 text-2xl font-bold tracking-wide text-navy">1930</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            If money has been lost or a scam is happening right now, call the national cybercrime
            helpline and preserve screenshots, numbers, links, and payment details.
          </p>
          <a href="tel:1930" className="btn-primary mt-4">
            Call 1930
          </a>
        </div>
      </section>
    </Layout>
  );
}
