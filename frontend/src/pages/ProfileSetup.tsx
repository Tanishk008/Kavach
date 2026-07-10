import { useState } from "react";
import { useNavigate } from "react-router-dom";

// Step definitions — key maps directly to kavach_profile field names
const STEPS = [
  {
    key: "language",
    q: "Choose your preferred language",
    options: [
      "English",
      "हिन्दी (Hindi)",
      "বাংলা (Bengali)",
      "தமிழ் (Tamil)",
      "తెలుగు (Telugu)",
      "मराठी (Marathi)",
      "ગુજરાતી (Gujarati)",
      "ಕನ್ನಡ (Kannada)",
      "മലയാളം (Malayalam)",
      "ਪੰਜਾਬੀ (Punjabi)",
      "ଓଡ଼ିଆ (Odia)",
      "اردو (Urdu)",
    ],
  },
  {
    key: "comfort",
    q: "How comfortable are you with using apps like WhatsApp or UPI?",
    options: ["Beginner", "Comfortable", "Very comfortable"],
  },
  {
    key: "ageGroup",
    q: "What's your age group?",
    options: ["Under 30", "30 to 60", "60 and above"],
  },
];

// Helper to load any previously saved profile so we don't overwrite avatar etc.
function loadExisting() {
  try {
    const saved = localStorage.getItem("kavach_profile");
    if (saved) return JSON.parse(saved);
  } catch {}
  return {};
}

export default function ProfileSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const total = STEPS.length + 1; // steps + emergency contact

  // Accumulated answers keyed by STEPS[].key
  const [answers, setAnswers] = useState<Record<string, string>>({
    language: "English",
    comfort: "Beginner",
    ageGroup: "60 and above",
  });

  // Emergency contact fields (last step)
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  const Dots = () => (
    <div className="mb-6 flex justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i <= step ? "w-5 bg-navy" : "h-2 w-2 bg-hairline"
          }`}
        />
      ))}
    </div>
  );

  // Just update the answer — does NOT auto-advance
  const selectOption = (key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  // Advance to the next step
  const goNext = () => setStep((s) => s + 1);

  // Saves everything and goes to home
  const finish = (skip = false) => {
    const existing = loadExisting();
    const profile = {
      ...existing,                         // keep avatar, name, sensitivity etc.
      language: answers.language,
      comfort: answers.comfort,
      ageGroup: answers.ageGroup,
      emergencyName: skip ? (existing.emergencyName ?? "") : emergencyName,
      emergencyPhone: skip ? (existing.emergencyPhone ?? "") : emergencyPhone,
      sensitivity: existing.sensitivity ?? "Standard",
    };
    localStorage.setItem("kavach_profile", JSON.stringify(profile));
    navigate("/home");
  };

  const currentKey = STEPS[step]?.key ?? "";
  const isLastInfoStep = step === STEPS.length - 1;

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-8">
      <Dots />

      {/* ── Step heading ── */}
      {step < STEPS.length && (
        <h1 className="text-2xl font-semibold text-ink">{STEPS[step].q}</h1>
      )}

      {/* ── Language step ── */}
      {step < STEPS.length && currentKey === "language" && (
        <div className="mt-5 grid grid-cols-1 gap-2">
          {STEPS[step].options.map((lang) => (
            <label
              key={lang}
              className={`flex cursor-pointer items-center gap-3 rounded-card border px-4 py-3 transition ${
                answers.language === lang
                  ? "border-saffron bg-canvas font-semibold text-navy"
                  : "border-hairline bg-surface hover:border-saffron hover:bg-canvas"
              }`}
            >
              <input
                type="radio"
                name="lang"
                className="accent-navy"
                checked={answers.language === lang}
                onChange={() => selectOption("language", lang)}
              />
              <span className="text-ink">{lang}</span>
            </label>
          ))}
        </div>
      )}

      {/* ── Comfort & Age group steps ── */}
      {step < STEPS.length && currentKey !== "language" && (
        <div className="mt-6 space-y-3">
          {STEPS[step].options.map((opt) => (
            <button
              key={opt}
              className={`btn-secondary text-left transition ${
                answers[currentKey] === opt
                  ? "border-saffron bg-canvas font-semibold text-navy"
                  : ""
              }`}
              onClick={() => selectOption(currentKey, opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* ── Next button for all non-emergency steps ── */}
      {step < STEPS.length && (
        <button
          className="btn-primary mt-6"
          onClick={isLastInfoStep ? goNext : goNext}
        >
          Next →
        </button>
      )}

      {/* ── Emergency contact (last step) ── */}
      {step === STEPS.length && (
        <>
          <h1 className="text-2xl font-semibold text-ink">Add an emergency contact</h1>
          <p className="mt-1 text-sm text-muted">
            One trusted person who can check in on you during a high-risk event. Optional.
          </p>

          <div className="mt-6 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Contact Name</label>
              <input
                className="input"
                placeholder="e.g. Priya (daughter)"
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Contact Phone</label>
              <input
                className="input"
                placeholder="10-digit mobile number"
                inputMode="numeric"
                maxLength={10}
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>

          <button className="btn-primary mt-6" onClick={() => finish(false)}>
            Save and continue
          </button>
          <button
            className="mt-3 w-full text-center text-sm text-muted"
            onClick={() => finish(true)}
          >
            Skip for now
          </button>
        </>
      )}
    </div>
  );
}
