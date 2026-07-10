import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KavachLogo } from "../components/Brand";
import { auth } from "../api/kavach";

export default function Login() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sendOtp = async () => {
    setError("");
    setLoading(true);
    try {
      await auth.sendOtp(phone);
    } catch {
      // Backend unavailable — proceed in demo mode (OTP: 123456)
    }
    localStorage.setItem("kavach_phone", phone);
    navigate("/otp", { state: { phone } });
    setLoading(false);
  };

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-6 py-8">
      <KavachLogo className="h-auto w-44 rounded-card" showWordmark />
      <h1 className="mt-6 text-2xl font-semibold text-ink">Enter your phone number</h1>

      <div className="mt-6 w-full">
        <div className="flex items-center gap-2">
          <span className="flex h-12 items-center rounded-card border border-hairline bg-surface px-3 text-ink">
            +91
          </span>
          <input
            className="input flex-1"
            inputMode="numeric"
            maxLength={10}
            placeholder="10-digit mobile number"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        {error && <p className="mt-2 text-sm text-highrisk">{error}</p>}
        <button className="btn-primary mt-4" disabled={phone.length !== 10 || loading} onClick={sendOtp}>
          {loading ? "Sending…" : "Send OTP"}
        </button>
        <p className="mt-3 text-center text-xs text-muted">
          We'll never share your number. Used only to keep your account secure.
        </p>
      </div>
    </div>
  );
}
