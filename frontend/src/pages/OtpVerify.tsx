import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { auth } from "../api/kavach";

export default function OtpVerify() {
  const navigate = useNavigate();
  const { state } = useLocation() as { state?: { phone?: string } };
  const phone = state?.phone ?? "";
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [seconds, setSeconds] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  const verify = async () => {
    const code = digits.join("");
    setError("");
    setLoading(true);
    try {
      const res = await auth.verifyOtp(phone, code);
      localStorage.setItem("kavach_phone", phone);
      navigate(res.onboarding_complete ? "/home" : "/setup", {
        state: { userId: res.user_id, phone },
      });
    } catch {
      // Backend unavailable — accept demo OTP 123456
      if (code === "123456") {
        localStorage.setItem("kavach_phone", phone);
        const profile = localStorage.getItem("kavach_profile");
        navigate(profile ? "/home" : "/setup", { state: { phone } });
      } else {
        setError("Incorrect OTP. Use 123456 in demo mode.");
      }
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError("");
    try {
      await auth.sendOtp(phone);
    } catch {
      // Demo mode — silently reset
    }
    setDigits(Array(6).fill(""));
    setSeconds(30);
    inputs.current[0]?.focus();
  };

  return (
    <div className="flex h-full flex-col justify-center overflow-y-auto px-6 py-8">
      <h1 className="text-2xl font-semibold text-ink">Enter the OTP sent to</h1>
      <p className="mt-1 text-muted">+91 {phone || "XXXXXXXXXX"}</p>

      {/* ── Demo OTP banner ── */}
      <div
        style={{
          marginTop: "16px",
          padding: "14px 16px",
          borderRadius: "12px",
          background: "linear-gradient(135deg, #1a1f36 0%, #2d3561 100%)",
          border: "1px solid rgba(99,132,255,0.45)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <span style={{ fontSize: "22px" }}>🔐</span>
        <div>
          <p
            style={{
              margin: 0,
              fontSize: "10px",
              color: "#8b95b5",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Demo Mode
          </p>
          <p
            style={{
              margin: "2px 0 0",
              fontSize: "14px",
              color: "#c8d0f0",
              fontWeight: 600,
            }}
          >
            OTP is&nbsp;
            <span
              style={{
                color: "#7b9fff",
                fontSize: "20px",
                fontWeight: 800,
                letterSpacing: "0.2em",
              }}
            >
              123456
            </span>
          </p>
        </div>
      </div>

      {/* ── 6-digit OTP boxes ── */}
      <div className="mt-6 flex justify-between gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => (inputs.current[i] = el)}
            className="h-14 w-12 rounded-card border border-hairline text-center text-xl outline-none focus:border-navy"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
          />
        ))}
      </div>

      <button
        className="mt-4 text-left text-sm text-navy disabled:text-muted"
        disabled={seconds > 0}
        onClick={resend}
      >
        {seconds > 0 ? `Resend OTP in ${seconds}s` : "Resend OTP"}
      </button>

      {error && <p className="mt-3 text-sm text-highrisk">{error}</p>}

      <button
        className="btn-primary mt-6"
        disabled={digits.join("").length !== 6 || loading}
        onClick={verify}
      >
        {loading ? "Verifying..." : "Verify and continue"}
      </button>
    </div>
  );
}
