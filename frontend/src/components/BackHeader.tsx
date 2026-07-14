import { useNavigate } from "react-router-dom";

interface BackHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
}

/** Reusable back-button header used on all feature pages. */
export default function BackHeader({ title, subtitle, badge }: BackHeaderProps) {
  const navigate = useNavigate();
  return (
    <div className="mb-4 flex items-center gap-3">
      <button
        onClick={() => navigate(-1)}
        aria-label="Go back"
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-hairline bg-surface text-muted shadow-sm transition hover:border-saffron hover:bg-canvas hover:text-ink active:scale-95"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-ink truncate">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
