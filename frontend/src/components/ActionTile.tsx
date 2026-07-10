import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

export default function ActionTile({
  icon,
  title,
  subtitle,
  to,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  to: string;
}) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      className="card flex min-h-[120px] flex-col items-start gap-2 text-left transition active:bg-canvas"
    >
      <span className="text-navy">{icon}</span>
      <span className="text-base font-semibold text-ink">{title}</span>
      <span className="text-xs text-muted">{subtitle}</span>
    </button>
  );
}
