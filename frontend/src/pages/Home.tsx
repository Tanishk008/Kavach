import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import ActionTile from "../components/ActionTile";
import { MapPinIcon, MessageIcon, NoteIcon, PhoneIcon, SearchIcon, ShieldIcon } from "../components/Icons";

export default function Home() {
  const navigate = useNavigate();
  return (
    <Layout>
      {/* Protection status card (turns amber/red when there is an active alert) */}
      <div className="card mb-4 flex items-center gap-3 border-india/30 bg-safe-bg">
        <ShieldIcon className="h-8 w-8 text-india" />
        <div>
          <p className="text-base font-semibold text-ink">You're protected</p>
          <p className="text-xs text-muted">No active alerts. Kavach is watching out for you.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ActionTile icon={<PhoneIcon />} title="Check a number" subtitle="Is this call or number safe?" to="/check-number" />
        <ActionTile icon={<MessageIcon />} title="Check a message" subtitle="Text, screenshot, or voice note" to="/check-message" />
        <ActionTile icon={<SearchIcon />} title="Check before you pay" subtitle="Verify a UPI ID or account" to="/check-pay" />
        <ActionTile icon={<NoteIcon />} title="Check currency" subtitle="Photograph a note" to="/check-currency" />
        <ActionTile icon={<MapPinIcon />} title="Risk map" subtitle="See current scam hotspots" to="/risk-map" />
      </div>

      <button className="btn-secondary mt-4" onClick={() => navigate("/report")}>
        Report a scam
      </button>
    </Layout>
  );
}
