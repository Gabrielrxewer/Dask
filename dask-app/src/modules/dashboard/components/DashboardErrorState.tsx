import { AppIcon, Button, EmptyState } from "@/shared/ui";

export function DashboardErrorState({
  message,
  onRetry
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <EmptyState
      className="dashboard-error-state"
      variant="error"
      title="Nao foi possivel carregar este dashboard"
      description={message}
      primaryAction={
        <Button variant="outline" size="sm" onClick={onRetry}>
          <AppIcon name="refresh" size={14} />
          Tentar novamente
        </Button>
      }
    />
  );
}
