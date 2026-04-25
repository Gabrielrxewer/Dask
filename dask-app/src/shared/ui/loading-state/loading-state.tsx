import { cn } from "@/shared/lib/cn";

export type LoadingAnimation =
  | "workspace"
  | "board"
  | "list"
  | "timeline"
  | "agenda"
  | "documentation"
  | "ai"
  | "automation"
  | "billing"
  | "fiscal"
  | "leads"
  | "marketing"
  | "settings";

interface LoadingStateProps {
  text?: string;
  animation?: LoadingAnimation;
  variant?: "inline" | "frame";
  visible?: boolean;
  className?: string;
}

const animationGlyphs: Record<LoadingAnimation, string[]> = {
  workspace: ["D", "A", "S", "K"],
  board: ["todo", "doing", "done"],
  list: ["01", "02", "03"],
  timeline: ["09:00", "13:30", "18:00"],
  agenda: ["seg", "qua", "sex"],
  documentation: ["doc", "md", "pdf"],
  ai: ["AI", "ctx", "run"],
  automation: ["if", "then", "ok"],
  billing: ["R$", "$", "EUR"],
  fiscal: ["NFe", "RPS", "DAS"],
  leads: ["MQL", "SQL", "won"],
  marketing: ["ads", "mail", "utm"],
  settings: ["cfg", "ui", "api"]
};

function renderLoadingVisual(animation: LoadingAnimation) {
  if (animation === "billing") {
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
    <div className={`shared-loading-state__visual shared-loading-state__visual--${animation}`}>
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
  className
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

  return (
    <div
      style={frameStyle}
      className={cn(
        "shared-loading-state",
        `shared-loading-state--${variant}`,
        `shared-loading-state--${animation}`,
        !visible && "shared-loading-state--out",
        className
      )}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
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
