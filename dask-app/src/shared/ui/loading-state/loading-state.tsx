interface LoadingStateProps {
  text?: string;
}

export function LoadingState({ text = "Carregando..." }: LoadingStateProps) {
  return (
    <div className="shared-loading-state" role="status" aria-live="polite">
      <span className="shared-loading-state__spinner" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <p>{text}</p>
    </div>
  );
}
