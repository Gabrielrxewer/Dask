import type { AppIconName, MetricCardTone } from "@/shared/ui";
import type {
  DashboardKpiData,
  DashboardSeriesData,
  DashboardSeriesItem,
  DashboardWidget
} from "@/modules/dashboard/types";

export type DashboardTabId = "overview" | "crm" | "funnel" | "automation";

export interface DashboardTabConfig {
  id: DashboardTabId;
  label: string;
  emptyTitle: string;
  emptyDescription: string;
}

export interface DashboardKpiView {
  id: string;
  label: string;
  value: string | number;
  subtitle: string;
  description?: string;
  icon: AppIconName;
  accent: MetricCardTone;
  unavailable?: boolean;
}

type KpiDefinition = {
  id: string;
  label: string;
  icon: AppIconName;
  accent: MetricCardTone;
  widgetId?: string;
  deriveValue?: (widgets: DashboardWidget[]) => number | null;
  subtitle: (value: number, widget?: DashboardWidget) => string;
  unavailableSubtitle?: (widget: DashboardWidget) => string;
};

export const DASHBOARD_TABS: DashboardTabConfig[] = [
  {
    id: "overview",
    label: "Visao geral",
    emptyTitle: "Nenhum indicador encontrado",
    emptyDescription: "Ajuste o periodo ou remova filtros para visualizar a operacao."
  },
  {
    id: "crm",
    label: "CRM/Kanban",
    emptyTitle: "Sem dados de CRM/Kanban",
    emptyDescription: "Os filtros atuais nao retornaram cards ativos para o painel operacional."
  },
  {
    id: "funnel",
    label: "Funil comercial",
    emptyTitle: "Funil comercial sem dados confiaveis",
    emptyDescription: "Ajuste os filtros ou configure etapas comerciais para acompanhar conversao."
  },
  {
    id: "automation",
    label: "Automacoes",
    emptyTitle: "Sem dados de automacoes",
    emptyDescription: "Nao encontramos execucoes, falhas ou aprovacoes para os filtros atuais."
  }
];

const DASHBOARD_WIDGET_GROUPS: Record<DashboardTabId, string[]> = {
  overview: [
    "commercial-funnel",
    "cards-by-state",
    "cards-by-assignee",
    "automation-runs-by-status"
  ],
  crm: [
    "cards-by-column",
    "cards-by-state",
    "cards-by-assignee",
    "commercial-funnel",
    "average-aging-by-stage"
  ],
  funnel: [
    "commercial-funnel",
    "cards-by-column",
    "completed-work-items-in-period",
    "average-aging-by-stage"
  ],
  automation: [
    "automation-runs-by-status",
    "automation-failures-by-workflow"
  ]
};

const KPI_GROUPS: Record<DashboardTabId, string[]> = {
  overview: [
    "active-work-items",
    "overdue-work-items",
    "unassigned-work-items",
    "created-work-items-in-period",
    "automation-runs-total",
    "automation-runs-failed"
  ],
  crm: [
    "active-work-items",
    "overdue-work-items",
    "unassigned-work-items",
    "created-work-items-in-period"
  ],
  funnel: [
    "active-work-items",
    "created-work-items-in-period",
    "completed-work-items-in-period",
    "overdue-work-items"
  ],
  automation: [
    "automation-runs-total",
    "automation-runs-failed",
    "pending-human-approvals"
  ]
};

function isKpiData(data: unknown): data is DashboardKpiData {
  return Boolean(data) && typeof data === "object" && typeof (data as DashboardKpiData).value === "number";
}

function isSeriesData(data: unknown): data is DashboardSeriesData {
  return Boolean(data) && typeof data === "object" && Array.isArray((data as DashboardSeriesData).items);
}

export function getDashboardTabConfig(tab: DashboardTabId): DashboardTabConfig {
  return DASHBOARD_TABS.find((item) => item.id === tab) ?? DASHBOARD_TABS[0];
}

export function getSeriesItems(widget: DashboardWidget | undefined): DashboardSeriesItem[] {
  if (!widget || !isSeriesData(widget.data)) {
    return [];
  }

  return widget.data.items.filter((item) => Number.isFinite(item.value));
}

export function getWidgetNumericValue(widget: DashboardWidget | undefined): number | null {
  if (!widget || widget.status === "unavailable" || !isKpiData(widget.data)) {
    return null;
  }

  return widget.data.value;
}

export function findDashboardWidget(widgets: DashboardWidget[], idOrMetricKey: string): DashboardWidget | undefined {
  return widgets.find((widget) => widget.id === idOrMetricKey || widget.metricKey === idOrMetricKey);
}

export function getDashboardWidgetsForTab(tab: DashboardTabId, widgets: DashboardWidget[]): DashboardWidget[] {
  const ids = DASHBOARD_WIDGET_GROUPS[tab];
  return ids.flatMap((id) => {
    const widget = findDashboardWidget(widgets, id);
    return widget ? [widget] : [];
  });
}

function getSeriesTotal(widget: DashboardWidget | undefined): number | null {
  const items = getSeriesItems(widget);
  if (items.length === 0) {
    return null;
  }

  return items.reduce((total, item) => total + item.value, 0);
}

function getSeriesValue(widget: DashboardWidget | undefined, ids: string[]): number | null {
  const items = getSeriesItems(widget);
  if (items.length === 0) {
    return null;
  }

  return items
    .filter((item) => ids.includes(String(item.id ?? item.label).toLowerCase()))
    .reduce((total, item) => total + item.value, 0);
}

const KPI_DEFINITIONS: Record<string, KpiDefinition> = {
  "active-work-items": {
    id: "active-work-items",
    label: "Cards ativos",
    icon: "board",
    accent: "blue",
    widgetId: "active-work-items",
    subtitle: (value) => value === 1 ? "Em estado nao terminal" : "Em estados nao terminais"
  },
  "overdue-work-items": {
    id: "overdue-work-items",
    label: "Cards vencidos",
    icon: "calendar-check",
    accent: "warning",
    widgetId: "overdue-work-items",
    subtitle: (value) => value > 0 ? "Precisam de acao no periodo" : "Nenhum atraso no periodo"
  },
  "unassigned-work-items": {
    id: "unassigned-work-items",
    label: "Sem responsavel",
    icon: "user",
    accent: "purple",
    widgetId: "unassigned-work-items",
    subtitle: (value) => value > 0 ? "Cards sem owner definido" : "Todos os cards tem owner"
  },
  "created-work-items-in-period": {
    id: "created-work-items-in-period",
    label: "Criados no periodo",
    icon: "plus",
    accent: "success",
    widgetId: "created-work-items-in-period",
    subtitle: () => "Novos cards dentro do filtro"
  },
  "completed-work-items-in-period": {
    id: "completed-work-items-in-period",
    label: "Concluidos",
    icon: "square-check",
    accent: "info",
    widgetId: "completed-work-items-in-period",
    subtitle: () => "Fechamentos dentro do periodo",
    unavailableSubtitle: (widget) => widget.unavailableReason ?? "Metrica ainda sem read model confiavel."
  },
  "automation-runs-total": {
    id: "automation-runs-total",
    label: "Automacoes executadas",
    icon: "automation",
    accent: "info",
    deriveValue: (widgets) => getSeriesTotal(findDashboardWidget(widgets, "automation-runs-by-status")),
    subtitle: () => "Runs no periodo filtrado"
  },
  "automation-runs-failed": {
    id: "automation-runs-failed",
    label: "Falhas de automacao",
    icon: "alert-circle",
    accent: "danger",
    deriveValue: (widgets) => getSeriesValue(findDashboardWidget(widgets, "automation-runs-by-status"), ["failed", "falhou"]),
    subtitle: (value) => value > 0 ? "Execucoes com erro" : "Sem falhas no periodo"
  },
  "pending-human-approvals": {
    id: "pending-human-approvals",
    label: "Aprovacoes pendentes",
    icon: "square-check",
    accent: "warning",
    widgetId: "pending-human-approvals",
    subtitle: (value) => value > 0 ? "Aguardando decisao humana" : "Nenhuma aprovacao pendente"
  }
};

export function buildDashboardKpis(tab: DashboardTabId, widgets: DashboardWidget[]): DashboardKpiView[] {
  return KPI_GROUPS[tab].flatMap<DashboardKpiView>((id): DashboardKpiView[] => {
    const definition = KPI_DEFINITIONS[id];
    if (!definition) {
      return [];
    }

    const widget = definition.widgetId ? findDashboardWidget(widgets, definition.widgetId) : undefined;

    if (widget?.status === "unavailable") {
      return [{
        id: definition.id,
        label: definition.label,
        value: "-",
        subtitle: definition.unavailableSubtitle?.(widget) ?? widget.unavailableReason ?? "Metrica indisponivel.",
        description: widget.description,
        icon: definition.icon,
        accent: definition.accent,
        unavailable: true
      }];
    }

    const derivedValue = definition.deriveValue?.(widgets);
    const value = derivedValue ?? getWidgetNumericValue(widget);

    if (value === null) {
      return [];
    }

    return [{
      id: definition.id,
      label: definition.label,
      value,
      subtitle: definition.subtitle(value, widget),
      description: widget?.description,
      icon: definition.icon,
      accent: definition.accent
    }];
  });
}
