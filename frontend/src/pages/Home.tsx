import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import ActionTile from "../components/ActionTile";
import KavachBot from "../components/KavachBot";
import { MapPinIcon, MessageIcon, NoteIcon, PhoneIcon, SearchIcon, ShieldIcon, AlertTriangleIcon } from "../components/Icons";
import { feed, users } from "../api/kavach";
import type { LiveAlert } from "../api/types";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [currentAlertIdx, setCurrentAlertIdx] = useState(0);
  const [score, setScore] = useState(0);

  useEffect(() => {
    feed.getAlerts().then(setAlerts).catch(console.error);
    users.getScore().then(res => setScore(res.score)).catch(console.error);
  }, []);

  useEffect(() => {
    if (alerts.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentAlertIdx((prev) => (prev + 1) % alerts.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [alerts]);

  return (
    <Layout>
      {/* Dynamic Protection Status Card */}
      <div className={`card mb-4 flex items-center gap-3 ${alerts.length > 0 ? "border-saffron/30 bg-saffron/10" : "border-india/30 bg-safe-bg"}`}>
        {alerts.length > 0 ? (
          <AlertTriangleIcon className="h-8 w-8 text-saffron shrink-0" />
        ) : (
          <ShieldIcon className="h-8 w-8 text-india shrink-0" />
        )}
        <div className="flex-1 overflow-hidden">
          <p className="text-base font-semibold text-ink">
            {alerts.length > 0 ? "Live Threat Alerts" : "You're protected"}
          </p>
          <div className="h-4 relative mt-0.5">
            <AnimatePresence mode="popLayout">
              {alerts.length > 0 ? (
                <motion.p
                  key={alerts[currentAlertIdx].id}
                  initial={{ y: 15, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -15, opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="text-xs text-saffron font-medium truncate absolute inset-0"
                >
                  {alerts[currentAlertIdx].scam_type} reported in {alerts[currentAlertIdx].region_city}
                </motion.p>
              ) : (
                <motion.p className="text-xs text-muted absolute inset-0">
                  No active alerts. Kavach is watching out for you.
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Cyber Score Section */}
      <div className="card mb-6 flex items-center justify-between bg-gradient-to-br from-surface to-canvas border border-hairline relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <ShieldIcon className="w-32 h-32" />
        </div>
        <div className="z-10">
          <h3 className="font-semibold text-ink text-lg">Cyber Score</h3>
          <p className="text-xs text-muted max-w-[180px] mt-1">
            Complete daily quizzes and scan messages to improve your score!
          </p>
        </div>
        <div className="z-10 relative flex items-center justify-center shrink-0 w-16 h-16 rounded-full border-[3px] border-canvas shadow-sm bg-surface">
          <svg className="w-16 h-16 absolute transform -rotate-90">
            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-hairline" />
            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray={175.9} strokeDashoffset={175.9 - (175.9 * score) / 100} className="text-india transition-all duration-1000 ease-out" />
          </svg>
          <span className="font-bold text-ink text-lg">{score}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ActionTile icon={<PhoneIcon />} title="Check a number" subtitle="Is this call or number safe?" to="/check-number" />
        <ActionTile icon={<MessageIcon />} title="Check Message & Voice" subtitle="Text, screenshot, or voice note" to="/check-message" />
        <ActionTile icon={<SearchIcon />} title="Fraud directory" subtitle="UPI, phone, or bank account" to="/check-pay" />
        <ActionTile icon={<NoteIcon />} title="Check currency" subtitle="Photograph a note" to="/check-currency" />
        <ActionTile icon={<MapPinIcon />} title="Risk map" subtitle="See current scam hotspots" to="/risk-map" />
        <ActionTile icon={<ShieldIcon />} title="Emergency help" subtitle="1930 and fraud reporting" to="/helpline" />
      </div>

      {/* WhatsApp Bot Banner */}
      <button
        className="mt-3 w-full flex items-center gap-3 rounded-card p-3.5 text-left transition active:scale-[0.98]"
        style={{ background: "linear-gradient(135deg, #075E54, #25D366)", border: "none" }}
        onClick={() => navigate("/whatsapp-bot")}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Add Kavach on WhatsApp</p>
          <p className="text-xs text-white/75 mt-0.5">Forward suspicious texts, images & voice notes</p>
        </div>
        <svg className="w-4 h-4 text-white/70 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <button className="btn-secondary mt-4" onClick={() => navigate("/report")}>
        Report a scam
      </button>

      <KavachBot />
    </Layout>
  );
}
