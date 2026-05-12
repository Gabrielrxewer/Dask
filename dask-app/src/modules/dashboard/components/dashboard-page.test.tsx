import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DashboardFilterOptions, DashboardResponse, DashboardWidget } from "@/modules/dashboard/types";
import { buildDashboardKpis, getDashboardWidgetsForTab } from "@/modules/dashboard/model";
import { DashboardPageView } from "./DashboardPage";
import { DashboardTopNavigation } from "./DashboardTopNavigation";
import { buildDashboardFilterChips } from "./DashboardFilters";
import { WidgetRenderer } from "./WidgetRenderer";

const filterOptions: DashboardFilterOptions = {
  members: [{ id: "user-1", label: "Ana" }],
  itemTypes: [{ id: "type-workItem", label: "WorkItem" }],
  states: [{ id: "state-new", label: "Novo" }],
  columns: [{ id: "col-new", label: "Novo WorkItem" }],
  workflows: [{ id: "workflow-1", label: "Follow-up" }],
  automationStatuses: [{ id: "failed", label: "Falhou" }]
};

const widgets: DashboardWidget[] = [
  {
    id: "active-work-items",
    type: "kpi",
    title: "Cards ativos",
    description: "Cards em estados nao terminais no workspace.",
    metricKey: "crm.activeWorkItems",
    data: { value: 42 }
  },
  {
    id: "overdue-work-items",
    type: "kpi",
    title: "Cards vencidos",
    metricKey: "crm.overdueWorkItems",
    data: { value: 0 }
  },
  {
    id: "unassigned-work-items",
    type: "kpi",
    title: "Sem responsavel",
    metricKey: "crm.unassignedWorkItems",
    data: { value: 1 }
  },
  {
    id: "created-work-items-in-period",
    type: "kpi",
    title: "Criados no periodo",
    metricKey: "crm.createdWorkItemsInPeriod",
    data: { value: 5 }
  },
  {
    id: "cards-by-column",
    type: "bar",
    title: "Cards por etapa",
    metricKey: "crm.cardsByColumn",
    data: {
      items: [
        { id: "col-new", label: "Novo WorkItem", value: 10 },
        { id: "col-empty", label: "Sem movimento", value: 0 }
      ]
    }
  },
  {
    id: "commercial-funnel",
    type: "funnel",
    title: "Funil operacional",
    metricKey: "crm.commercialFunnel",
    data: { items: [{ id: "col-new", label: "Novo WorkItem", value: 10 }] }
  },
  {
    id: "cards-by-state",
    type: "pie",
    title: "Cards por estado",
    metricKey: "crm.cardsByState",
    data: { items: [{ id: "state-new", label: "Novo", value: 10 }] }
  },
  {
    id: "cards-by-assignee",
    type: "bar",
    title: "Cards por responsavel",
    metricKey: "crm.cardsByAssignee",
    data: { items: [{ id: "user-1", label: "Ana", value: 4 }] }
  },
  {
    id: "automation-runs-by-status",
    type: "bar",
    title: "Execucoes por status",
    metricKey: "automation.runsByStatus",
    data: {
      items: [
        { id: "completed", label: "Concluido", value: 7 },
        { id: "failed", label: "Falhou", value: 2 }
      ]
    }
  },
  {
    id: "automation-failures-by-workflow",
    type: "table",
    title: "Falhas por workflow",
    metricKey: "automation.failuresByWorkflow",
    data: {
      columns: [
        { key: "workflow", label: "Workflow" },
        { key: "failures", label: "Falhas" }
      ],
      rows: [{ workflow: "Follow-up", failures: 2 }]
    }
  },
  {
    id: "pending-human-approvals",
    type: "kpi",
    title: "Aprovacoes pendentes",
    metricKey: "automation.pendingHumanApprovals",
    data: { value: 3 }
  },
  {
    id: "completed-work-items-in-period",
    type: "kpi",
    title: "Concluidos no periodo",
    metricKey: "crm.completedWorkItemsInPeriod",
    status: "unavailable",
    unavailableReason: "Sem completedAt confiavel.",
    data: { unavailable: true, reason: "Sem completedAt confiavel." }
  },
  {
    id: "average-aging-by-stage",
    type: "table",
    title: "Aging medio por etapa",
    metricKey: "crm.averageAgingByStage",
    status: "unavailable",
    unavailableReason: "Sem historico de entrada na coluna.",
    data: { unavailable: true, reason: "Sem historico de entrada na coluna." }
  }
];

const dashboard: DashboardResponse = {
  workspaceId: "workspace-1",
  generatedAt: "2026-05-09T12:00:00.000Z",
  scope: "overview",
  filters: {},
  widgets
};

function renderView(overrides: Partial<Parameters<typeof DashboardPageView>[0]> = {}) {
  return renderToStaticMarkup(
    <DashboardPageView
      dashboard={dashboard}
      filters={{ from: "2026-05-01T00:00:00.000Z", to: "2026-05-09T23:59:59.999Z" }}
      filterOptions={filterOptions}
      activeTab="overview"
      isLoading={false}
      error={null}
      onRefresh={vi.fn()}
      {...overrides}
    />
  );
}

describe("DashboardPageView", () => {
  it("renders production dashboard content, active filter chips, KPIs and widgets", () => {
    const html = renderView();

    expect(html).not.toContain("shared-page-header");
    expect(html).not.toContain("Acompanhe operacao, funil comercial e automacoes em tempo real.");
    expect(html).toContain("Periodo: 01/05/2026 -&gt; 09/05/2026");
    expect(html).not.toContain("Mais filtros");
    expect(html).toContain("Cards ativos");
    expect(html).toContain("42");
    expect(html).toContain("Automacoes executadas");
    expect(html).toContain("Funil operacional");
    expect(html).toContain("Cards por estado");
  });

  it("renders loading skeletons without replacing the layout with a blank frame", () => {
    const html = renderView({ dashboard: null, isLoading: true });

    expect(html).toContain("dashboard-skeleton");
    expect(html).toContain("Carregando dashboard");
    expect(html).toContain("dashboard-widget-skeleton");
  });

  it("renders tab-specific empty state", () => {
    const html = renderView({
      dashboard: { ...dashboard, widgets: [] },
      activeTab: "automation",
      isLoading: false
    });

    expect(html).toContain("Sem dados de automacoes");
    expect(html).toContain("Nao encontramos execucoes");
  });

  it("renders error state with retry action", () => {
    const html = renderView({ dashboard: null, error: "Falha de rede" });

    expect(html).toContain("Nao foi possivel carregar este dashboard");
    expect(html).toContain("Falha de rede");
    expect(html).toContain("Tentar novamente");
  });

  it("renders active filter chips without keeping form controls exposed", () => {
    const html = renderView();

    expect(html).toContain("Periodo: 01/05/2026 -&gt; 09/05/2026");
    expect(html).not.toContain('type="date"');
    expect(html).not.toContain("Limpar");
  });

  it("renders CRM tab with operational widgets instead of overview widgets", () => {
    const html = renderView({ activeTab: "crm" });

    expect(html).toContain("Cards por etapa");
    expect(html).toContain("Cards por responsavel");
    expect(html).toContain("Aging medio por etapa");
    expect(html).not.toContain("Falhas por workflow");
  });
});

describe("Dashboard view model", () => {
  it("groups widgets by dashboard tab", () => {
    const overviewWidgets = getDashboardWidgetsForTab("overview", widgets).map((widget) => widget.id);
    const automationWidgets = getDashboardWidgetsForTab("automation", widgets).map((widget) => widget.id);

    expect(overviewWidgets).toEqual([
      "commercial-funnel",
      "cards-by-state",
      "cards-by-assignee",
      "automation-runs-by-status"
    ]);
    expect(automationWidgets).toEqual([
      "automation-runs-by-status",
      "automation-failures-by-workflow"
    ]);
  });

  it("derives automation KPI values from status series", () => {
    const kpis = buildDashboardKpis("automation", widgets);

    expect(kpis).toContainEqual(expect.objectContaining({ id: "automation-runs-total", value: 9 }));
    expect(kpis).toContainEqual(expect.objectContaining({ id: "automation-runs-failed", value: 2 }));
    expect(kpis).toContainEqual(expect.objectContaining({ id: "pending-human-approvals", value: 3 }));
  });

  it("builds readable active filter chips", () => {
    const chips = buildDashboardFilterChips({
      from: "2026-05-01T00:00:00.000Z",
      to: "2026-05-09T23:59:59.999Z",
      assigneeId: "user-1",
      status: "failed"
    }, filterOptions);

    expect(chips.map((chip) => chip.label)).toEqual([
      "Periodo: 01/05/2026 -> 09/05/2026",
      "Responsavel: Ana",
      "Status: Falhou"
    ]);
  });
});

describe("DashboardTopNavigation", () => {
  it("places tabs and icon-only actions in the workspace top navigation", () => {
    const html = renderToStaticMarkup(
      <DashboardTopNavigation
        activeTab="funnel"
        activeFilterCount={2}
        isRefreshing={false}
        generatedAt="2026-05-09T12:00:00.000Z"
        onTabChange={vi.fn()}
        onOpenFilters={vi.fn()}
        onResetFilters={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    expect(html).toContain("role=\"tablist\"");
    expect(html).toContain("Funil comercial");
    expect(html).toContain("aria-selected=\"true\"");
    expect(html).toContain("aria-label=\"Filtros ativos: 2\"");
    expect(html).toContain("aria-label=\"Atualizar dashboard.");
    expect(html).toContain("aria-label=\"Limpar filtros\"");
    expect(html).toContain("workspace-action-button");
  });
});

describe("WidgetRenderer", () => {
  it("renders KPI and chart widgets by type", () => {
    const kpi = renderToStaticMarkup(<WidgetRenderer widget={widgets[0]} />);
    const chart = renderToStaticMarkup(<WidgetRenderer widget={widgets[4]} />);

    expect(kpi).toContain("42");
    expect(chart).toContain("dashboard-chart");
    expect(chart).toContain("Novo WorkItem");
  });

  it("keeps zero-value chart rows collapsed behind a toggle", () => {
    const chart = renderToStaticMarkup(<WidgetRenderer widget={widgets[4]} />);

    expect(chart).toContain("Mostrar etapas zeradas (1)");
    expect(chart).not.toContain("Sem movimento");
  });

  it("renders unavailable widgets with documented reason", () => {
    const html = renderToStaticMarkup(<WidgetRenderer widget={widgets[12]} />);

    expect(html).toContain("Metrica indisponivel");
    expect(html).toContain("Sem historico de entrada na coluna.");
  });
});
