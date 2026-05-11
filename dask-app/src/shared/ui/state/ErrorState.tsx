import type { ReactNode } from "react";
import { AppIcon } from "@/shared/ui/icon";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";

export interface ErrorStateProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Nao foi possivel carregar",
  description = "Tente novamente em alguns instantes.",
  action,
  retryLabel = "Tentar novamente",
  onRetry,
  className
}: ErrorStateProps) {
  const resolvedAction = action ?? (onRetry ? (
    <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
      {retryLabel}
    </Button>
  ) : null);

  return (
    <EmptyState
      className={className}
      variant="error"
      title={title}
      description={description}
      icon={<AppIcon name="alert-circle" size={22} />}
      action={resolvedAction}
    />
  );
}

