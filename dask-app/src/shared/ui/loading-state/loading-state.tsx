interface LoadingStateProps {
  text?: string;
}

export function LoadingState({ text = "Carregando..." }: LoadingStateProps) {
  return <p className="shared-loading-state">{text}</p>;
}
