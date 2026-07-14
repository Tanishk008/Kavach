import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import BackHeader from "../components/BackHeader";
import { users } from "../api/kavach";
import type { UserEvent } from "../api/types";
import { MessageIcon, PhoneIcon, SearchIcon, ShieldIcon } from "../components/Icons";

export default function History() {
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    users.getEvents()
      .then(setEvents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getIcon = (type: string) => {
    if (type === "number") return <PhoneIcon className="h-5 w-5" />;
    if (type === "payment") return <SearchIcon className="h-5 w-5" />;
    if (type === "text" || type === "voice" || type === "image") return <MessageIcon className="h-5 w-5" />;
    return <ShieldIcon className="h-5 w-5" />;
  };

  const getTierColor = (tier: string) => {
    if (tier === "high_risk") return "text-saffron bg-saffron/10 border-saffron/30";
    if (tier === "caution") return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-india bg-india/10 border-india/30";
  };

  return (
    <Layout>
      <BackHeader title="Activity History" />
      
      <div className="py-2">
        <p className="text-sm text-muted mb-4 px-1">Your recent cybersecurity scans and checks are securely logged here.</p>
        
        {loading ? (
          <div className="text-center py-8 text-muted">Loading history...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 px-4 bg-canvas rounded-card border border-hairline mt-4">
            <ShieldIcon className="w-12 h-12 text-muted mx-auto mb-3 opacity-50" />
            <h3 className="text-ink font-medium">No activity yet</h3>
            <p className="text-sm text-muted mt-1">When you scan messages or numbers, they will appear here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {events.map((evt) => (
              <div key={evt.id} className={`card flex items-start gap-3 border ${getTierColor(evt.tier)}`}>
                <div className="mt-0.5 opacity-80">{getIcon(evt.input_type)}</div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold text-sm capitalize">{evt.input_type} Scan</span>
                    <span className="text-[10px] uppercase font-bold opacity-70 tracking-wider">
                      {new Date(evt.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {evt.content_excerpt && (
                    <p className="text-xs opacity-90 truncate max-w-[240px]">"{evt.content_excerpt}"</p>
                  )}
                  {evt.scam_type && (
                    <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full bg-white/50 text-[10px] font-bold border border-black/5">
                      {evt.scam_type}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
