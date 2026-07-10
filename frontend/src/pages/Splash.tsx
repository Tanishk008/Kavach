import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { IndianMonumentStrip, KavachLogo } from "../components/Brand";

export default function Splash() {
  const navigate = useNavigate();
  useEffect(() => {
    const t = setTimeout(() => navigate("/login"), 3500);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="relative flex h-full overflow-hidden flex-col items-center justify-center bg-saffron px-6 text-white">
      <button
        onClick={() => navigate("/login")}
        className="absolute right-4 top-4 text-sm text-white/80"
      >
        Skip
      </button>

      <KavachLogo className="h-auto w-64 rounded-card shadow-sm" showWordmark />
      <p className="mt-2 text-sm text-white/70">Protecting your loved ones, ahead of every fraud.</p>

      <IndianMonumentStrip className="absolute bottom-0 h-28 w-full animate-[float_5s_ease-in-out_infinite] text-white/95" />
    </div>
  );
}
