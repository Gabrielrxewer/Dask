import { cn } from "@/shared/lib/cn";
import type { ReactNode } from "react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export type MetricCardTone =
  | "default"
  | "blue"
  | "green"
  | "purple"
  | "amber"
  | "success"
  | "warning"
  | "danger"
  | "info";

export type MetricCardTrendTone = "positive" | "negative" | "neutral";

export interface MetricCardTrend {
  value: ReactNode;
  tone?: MetricCardTrendTone;
  label?: string;
}

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  subtitle?: ReactNode;
  helpText?: string;
  description?: string;
  icon?: ReactNode;
  tone?: MetricCardTone;
  accent?: MetricCardTone;
  trend?: ReactNode | MetricCardTrend;
  className?: string;
}

function isStructuredTrend(trend: MetricCardProps["trend"]): trend is MetricCardTrend {
  return Boolean(trend && typeof trend === "object" && "value" in trend);
}

export function MetricCard({
  label,
  value,
  subtitle,
  helpText,
  description,
  icon,
  tone = "default",
  accent,
  trend,
  className = ""
}: MetricCardProps) {
  const [isMounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLSpanElement | null>(null);
  const tooltipId = useId();
  const resolvedTone = accent ?? tone;
  const resolvedHelpText = helpText ?? description;
  const trendTone = isStructuredTrend(trend) ? trend.tone ?? "neutral" : "neutral";
  const trendValue = isStructuredTrend(trend) ? trend.value : trend;

  useEffect(() => {
    setMounted(true);
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!isOpen || !buttonRef.current || !popoverRef.current) {
      return;
    }

    const updatePosition = () => {
      if (!buttonRef.current || !popoverRef.current) {
        return;
      }

      const gap = 10;
      const viewportPadding = 12;
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const popoverRect = popoverRef.current.getBoundingClientRect();

      let left = buttonRect.right - popoverRect.width;
      left = Math.max(viewportPadding, Math.min(left, window.innerWidth - popoverRect.width - viewportPadding));

      let top = buttonRect.bottom + gap;
      if (top + popoverRect.height > window.innerHeight - viewportPadding) {
        top = buttonRect.top - popoverRect.height - gap;
      }
      top = Math.max(viewportPadding, top);

      setPopoverStyle({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  return (
    <article
      className={cn(
        "shared-metric-card",
        `shared-metric-card--${resolvedTone}`,
        icon ? "shared-metric-card--with-icon" : "",
        className
      )}
    >
      {icon ? <span className="shared-metric-card__icon" aria-hidden="true">{icon}</span> : null}
      <div className="shared-metric-card__body">
        <div className="shared-metric-card__head">
          <p className="shared-metric-card__label">{label}</p>
          {resolvedHelpText ? (
            <span
              className="shared-metric-card__info"
              onMouseEnter={() => setIsOpen(true)}
              onMouseLeave={() => setIsOpen(false)}
            >
              <button
                ref={buttonRef}
                type="button"
                className="shared-metric-card__info-button"
                aria-label={`Mais informacoes sobre ${label}`}
                aria-describedby={isOpen ? tooltipId : undefined}
                aria-expanded={isOpen}
                onFocus={() => setIsOpen(true)}
                onBlur={() => setIsOpen(false)}
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
              {isMounted && isOpen
                ? createPortal(
                    <span
                      ref={popoverRef}
                      id={tooltipId}
                      className="shared-metric-card__info-popover shared-metric-card__info-popover--portal"
                      role="tooltip"
                      style={{ top: `${popoverStyle.top}px`, left: `${popoverStyle.left}px` }}
                    >
                      <strong>{label}</strong>
                      <p>{resolvedHelpText}</p>
                    </span>,
                    document.body
                  )
                : null}
            </span>
          ) : null}
        </div>
        <h3 className="shared-metric-card__value">{value}</h3>
        {subtitle ? <p className="shared-metric-card__subtitle">{subtitle}</p> : null}
        {trendValue ? (
          <p
            className={cn("shared-metric-card__trend", `shared-metric-card__trend--${trendTone}`)}
            aria-label={isStructuredTrend(trend) ? trend.label : undefined}
          >
            {trendValue}
          </p>
        ) : null}
      </div>
    </article>
  );
}
