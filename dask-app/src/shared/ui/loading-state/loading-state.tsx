import { cn } from "@/shared/lib/cn";
import type { HTMLAttributes } from "react";

export type LoadingAnimation =
  | "default"
  | "workspace"
  | "dashboard"
  | "board"
  | "list"
  | "agenda"
  | "documentation"
  | "ai"
  | "automation"
  | "billing"
  | "fiscal"
  | "commercial"
  | "marketing"
  | "settings";

export interface LoadingStateProps extends HTMLAttributes<HTMLDivElement> {
  text?: string;
  animation?: LoadingAnimation;
  variant?: "inline" | "frame";
  visible?: boolean;
}

const animationGlyphs: Record<LoadingAnimation, string[]> = {
  default: ["01", "02", "03"],
  workspace: ["D", "A", "S", "K"],
  dashboard: ["kpi", "bar", "run"],
  board: ["todo", "doing", "done"],
  list: ["01", "02", "03"],
  agenda: ["seg", "qua", "sex"],
  documentation: ["doc", "md", "pdf"],
  ai: ["AI", "ctx", "run"],
  automation: ["if", "then", "ok"],
  billing: ["R$", "$", "EUR"],
  fiscal: ["NFe", "RPS", "DAS"],
  commercial: ["MQL", "SQL", "won"],
  marketing: ["ads", "mail", "utm"],
  settings: ["cfg", "ui", "api"]
};

function resolveVisualAnimation(animation: LoadingAnimation): Exclude<LoadingAnimation, "default"> {
  return animation === "default" ? "list" : animation;
}

function renderLoadingVisual(animation: LoadingAnimation) {
  const visualAnimation = resolveVisualAnimation(animation);

  if (visualAnimation === "billing") {
    return (
      <div className="shared-loading-state__card">
        <div className="shared-loading-state__card-face">
          <div className="shared-loading-state__card-top">
            <span className="shared-loading-state__chip" />
            <span className="shared-loading-state__signal" />
          </div>
          <div className="shared-loading-state__card-lines">
            <span />
            <span />
            <span />
          </div>
          <div className="shared-loading-state__card-meta">
            <span />
            <span />
          </div>
        </div>
        <div className="shared-loading-state__card-shimmer" />
      </div>
    );
  }

  return (
    <div className={`shared-loading-state__visual shared-loading-state__visual--${visualAnimation}`}>
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

export function LoadingState({
  text = "Carregando...",
  animation = "workspace",
  variant = "inline",
  visible = true,
  className,
  style,
  role = "status",
  "aria-live": ariaLive = "polite",
  "aria-hidden": ariaHidden,
  ...props
}: LoadingStateProps) {
  const glyphs = animationGlyphs[animation] ?? animationGlyphs.workspace;
  const frameStyle =
    variant === "frame"
      ? {
          position: "absolute" as const,
          inset: 0,
          zIndex: 50,
          minHeight: "100%"
        }
      : undefined;
  const hiddenStyle = !visible
    ? {
        pointerEvents: "none" as const,
        visibility: "hidden" as const
      }
    : undefined;

  return (
    <div
      style={{ ...style, ...frameStyle, ...hiddenStyle }}
      className={cn(
        "shared-loading-state",
        `shared-loading-state--${variant}`,
        `shared-loading-state--${animation}`,
        !visible && "shared-loading-state--out",
        className
      )}
      role={role}
      aria-live={ariaLive}
      aria-hidden={ariaHidden ?? !visible}
      {...props}
    >
      <div className="shared-loading-state__stage" aria-hidden="true">
        {glyphs.flatMap((glyph, glyphIndex) => [
          <span
            key={`${glyph}-a`}
            className={`shared-loading-state__particle shared-loading-state__particle--${glyphIndex + 1}`}
          >
            {glyph}
          </span>,
          <span
            key={`${glyph}-b`}
            className={`shared-loading-state__particle shared-loading-state__particle--${glyphIndex + 4}`}
          >
            {glyph}
          </span>
        ])}

        {renderLoadingVisual(animation)}

        <div className="shared-loading-state__bar-wrap">
          <div className="shared-loading-state__bar" />
        </div>
      </div>
      <p>
        {text}
        <span className="shared-loading-state__dots" />
      </p>
    </div>
  );
}
