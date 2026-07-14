import { useNavigate } from "react-router-dom";
import { KavachLogo } from "./Brand";
import {
  HeadsetIcon,
  MapPinIcon,
  MessageIcon,
  PhoneIcon,
  UserIcon,
} from "./Icons";

type Item = { label: string; to?: string; href?: string; hint?: string };

const ITEMS: Item[] = [
  { label: "Home", to: "/home" },
  { label: "Risk map", to: "/risk-map", hint: "View scam hotspots near you" },
  { label: "Check a number", to: "/check-number", hint: "Caller ID & fraud lookup" },
  { label: "Check Message & Voice", to: "/check-message", hint: "Text & AI voice deepfake detection" },
  { label: "Check UPI ID", to: "/check-upi", hint: "Verify UPI before sending money" },
  { label: "Activity History", to: "/history", hint: "Past scans and activity log" },
  { label: "Report a scam", to: "/report", hint: "File a cyber complaint" },
  { label: "Block lost or stolen phone", to: "/block-phone" },
  { label: "WhatsApp bot", to: "/check-message", hint: "Chat with the Kavach bot" },
  { label: "Call the helpline", href: "tel:1930", hint: "Toll-free IVR" },
  { label: "Emergency contact settings", to: "/profile" },
  { label: "Language", to: "/profile" },
  { label: "Safety tips and how it works", to: "/safety" },
  { label: "About Kavach", to: "/about" },
];

export default function SideMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-[1000]">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <nav className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-surface shadow-xl">
        <div className="flex items-center gap-2 bg-navy px-4 py-4 text-white">
          <KavachLogo className="h-12 w-auto rounded-md" showWordmark />
        </div>
        <ul className="py-2">
          {ITEMS.map((item, i) => (
            <li key={i}>
              <button
                className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left hover:bg-canvas"
                onClick={() => {
                  onClose();
                  if (item.href) window.location.href = item.href;
                  else if (item.to) navigate(item.to);
                }}
              >
                <span className="text-ink">{item.label}</span>
                {item.hint && <span className="text-xs text-muted">{item.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-center gap-4 py-4 text-muted">
          <PhoneIcon className="h-5 w-5" />
          <MessageIcon className="h-5 w-5" />
          <MapPinIcon className="h-5 w-5" />
          <HeadsetIcon className="h-5 w-5" />
          <UserIcon className="h-5 w-5" />
        </div>
      </nav>
    </div>
  );
}
