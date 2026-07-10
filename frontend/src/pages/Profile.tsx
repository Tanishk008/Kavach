import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { UserIcon } from "../components/Icons";

// Read profile from localStorage or use defaults
function loadProfile() {
  try {
    const saved = localStorage.getItem("kavach_profile");
    if (saved) return JSON.parse(saved);
  } catch {}
  return {
    name: "",
    ageGroup: "60 and above",
    comfort: "Beginner",
    language: "हिन्दी (Hindi)",
    sensitivity: "Standard",
    emergencyName: "",
    emergencyPhone: "",
    avatarUrl: "",
  };
}

export default function Profile() {
  const navigate = useNavigate();
  const phone = localStorage.getItem("kavach_phone") ?? "9990001234";
  const fileRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState(loadProfile());
  const [editingEmergency, setEditingEmergency] = useState(false);
  const [saved, setSaved] = useState(false);

  // Auto-save to localStorage whenever any field changes
  const set = (key: string, value: string) => {
    const updated = { ...profile, [key]: value };
    setProfile(updated);
    localStorage.setItem("kavach_profile", JSON.stringify(updated));
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const updated = { ...profile, avatarUrl: reader.result as string };
      setProfile(updated);
      localStorage.setItem("kavach_profile", JSON.stringify(updated));
    };
    reader.readAsDataURL(file);
  };

  const handleLogout = () => {
    localStorage.removeItem("kavach_phone");
    localStorage.removeItem("kavach_profile");
    navigate("/login");
  };

  const AGE_GROUPS = ["Under 30", "30 to 60", "60 and above"];
  const COMFORT_LEVELS = ["Beginner", "Comfortable", "Very comfortable"];
  const LANGUAGES = [
    "English", "हिन्दी (Hindi)", "বাংলা (Bengali)", "தமிழ் (Tamil)",
    "తెలుగు (Telugu)", "मराठी (Marathi)", "ગુજરાતી (Gujarati)", "ಕನ್ನಡ (Kannada)",
  ];
  const SENSITIVITIES = ["Extra cautious", "Standard", "Advanced"];

  return (
    <Layout>
      {/* ── Hero avatar strip ── */}
      <div className="relative -mx-4 -mt-4 mb-6 bg-gradient-to-br from-navy to-navy-dark px-6 pb-6 pt-8 text-white">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="group relative h-24 w-24 overflow-hidden rounded-full border-4 border-saffron/60 bg-saffron/20 shadow-lg transition hover:border-saffron"
            aria-label="Change profile photo"
          >
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <UserIcon className="m-auto h-12 w-12 translate-y-2 text-white/70" />
            )}
            {/* Camera overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 opacity-0 transition group-hover:opacity-100">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
              <span className="text-xs text-white">Change</span>
            </div>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />

          {/* Name & phone */}
          <div className="text-center">
            {profile.name ? (
              <p className="text-lg font-semibold text-white">{profile.name}</p>
            ) : (
              <p className="text-sm italic text-white/50">Add your name below</p>
            )}
            <p className="mt-0.5 text-sm font-medium text-saffron">+91 {phone}</p>
          </div>
        </div>
      </div>

      {/* ── Personal info ── */}
      <section className="mb-4">
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted">Personal Info</p>
        <div className="card space-y-4">
          {/* Name input */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Full Name</label>
            <input
              className="input"
              placeholder="Enter your name"
              value={profile.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          {/* Age group */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Age Group</label>
            <select
              className="input appearance-none"
              value={profile.ageGroup}
              onChange={(e) => set("ageGroup", e.target.value)}
            >
              {AGE_GROUPS.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>

          {/* Digital comfort */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Digital Comfort Level</label>
            <select
              className="input appearance-none"
              value={profile.comfort}
              onChange={(e) => set("comfort", e.target.value)}
            >
              {COMFORT_LEVELS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          {/* Language */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Preferred Language</label>
            <select
              className="input appearance-none"
              value={profile.language}
              onChange={(e) => set("language", e.target.value)}
            >
              {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* ── Emergency contact ── */}
      <section className="mb-4">
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted">Emergency Contact</p>
        <div className="card">
          {!editingEmergency && !profile.emergencyName ? (
            <>
              <p className="text-sm text-muted">Not set — add someone who can check in on you during a high-risk event.</p>
              <button
                className="btn-secondary mt-3"
                onClick={() => setEditingEmergency(true)}
              >
                + Add Contact
              </button>
            </>
          ) : editingEmergency ? (
            <div className="space-y-3">
              <input
                className="input"
                placeholder="Contact name"
                value={profile.emergencyName}
                onChange={(e) => set("emergencyName", e.target.value)}
              />
              <input
                className="input"
                placeholder="Contact phone number"
                inputMode="numeric"
                maxLength={10}
                value={profile.emergencyPhone}
                onChange={(e) => set("emergencyPhone", e.target.value.replace(/\D/g, ""))}
              />
              <div className="flex gap-2">
                <button
                  className="btn-primary"
                  onClick={() => setEditingEmergency(false)}
                >
                  Save Contact
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setEditingEmergency(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-ink">{profile.emergencyName}</p>
                <p className="text-sm text-muted">+91 {profile.emergencyPhone}</p>
              </div>
              <button
                className="rounded-lg border border-hairline px-3 py-1.5 text-sm font-medium text-navy transition hover:bg-canvas"
                onClick={() => setEditingEmergency(true)}
              >
                Edit
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Protection sensitivity ── */}
      <section className="mb-4">
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted">Protection Sensitivity</p>
        <div className="card space-y-3">
          {SENSITIVITIES.map((level) => (
            <label key={level} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition hover:bg-canvas">
              <input
                type="radio"
                name="sensitivity"
                checked={profile.sensitivity === level}
                onChange={() => set("sensitivity", level)}
                className="accent-navy h-4 w-4"
              />
              <div>
                <span className="font-medium text-ink">{level}</span>
                <p className="text-xs text-muted">
                  {level === "Extra cautious" && "Alert me on anything remotely suspicious"}
                  {level === "Standard" && "Balanced alerts for everyday use"}
                  {level === "Advanced" && "Only flag high-confidence threats"}
                </p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* ── Auto-save indicator ── */}
      {saved && (
        <p className="mb-2 text-center text-xs font-medium text-india">✓ Changes saved automatically</p>
      )}

      {/* ── Log out ── */}
      <button
        className="mb-6 w-full rounded-card border border-highrisk/40 bg-highrisk-bg py-3 text-sm font-semibold text-highrisk transition hover:bg-highrisk/10"
        onClick={handleLogout}
      >
        Log out
      </button>
    </Layout>
  );
}
