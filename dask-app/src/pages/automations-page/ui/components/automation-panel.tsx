import type { ReactNode } from "react";
import { AppIcon, Button, EmptyState } from "@/shared/ui";

export function AutomationPanelHeader({
  title,
  onRefresh
}: {
  title: string;
  onRefresh: () => Promise<unknown> | void;
}) {
  return (
    <div className="automation-studio__panel-header">
      <h2>{title}</h2>
      <Button size="sm" variant="outline" onClick={() => void onRefresh()}>
        <AppIcon name="refresh" size={14} />
        Atualizar
      </Button>
    </div>
  );
}

export function AutomationDataList<T>({
  items,
  empty,
  loading,
  error,
  render
}: {
  items: T[];
  empty: string;
  loading?: boolean;
  error?: unknown;
  render: (item: T) => ReactNode;
}) {
  if (loading) {
    return <EmptyState className="automation-studio__empty-panel" size="compact">Carregando...</EmptyState>;
  }

  if (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel carregar.";
    return <EmptyState className="automation-studio__empty-panel" size="compact">{message}</EmptyState>;
  }

  if (items.length === 0) {
    return <EmptyState className="automation-studio__empty-panel" size="compact">{empty}</EmptyState>;
  }

  return <div className="automation-studio__list">{items.map(render)}</div>;
}
