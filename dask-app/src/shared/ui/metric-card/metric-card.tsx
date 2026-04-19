import { cn } from "@/shared/lib/cn";

interface MetricCardProps {
  label: string;
  value: string | number;
  description?: string;
  className?: string;
}

export function MetricCard({ label, value, description, className = "" }: MetricCardProps) {
  return (
    <article className={cn("shared-metric-card", className)}>
      <div className="shared-metric-card__head">
        <p>{label}</p>
        {description ? (
          <span className="shared-metric-card__info">
            <button
              type="button"
              className="shared-metric-card__info-button"
              aria-label={`Mais informacoes sobre ${label}`}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 17v-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M12 8h.01"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
                <path
                  d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
            <span className="shared-metric-card__info-popover" role="tooltip">
              <strong>{label}</strong>
              <p>{description}</p>
            </span>
          </span>
        ) : null}
      </div>
      <h3>{value}</h3>
    </article>
  );
}
