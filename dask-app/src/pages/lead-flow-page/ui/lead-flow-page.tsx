import { useCallback, useEffect, useMemo, type CSSProperties } from "react";
import { MarkerType, type Edge, type Node, type NodeProps, type OnEdgesChange, type OnNodesChange } from "@xyflow/react";
import { useSearchParams } from "react-router-dom";
import { buildBoardMetrics, type Task, type TaskStatus } from "@/entities/task";
import { useWorkspace } from "@/modules/workspace";
import { formatMoneyCompact } from "@/shared/lib/money";
import { cn } from "@/shared/lib/cn";
import { AppIcon, EmptyState, FlowCanvas, FlowNodeCard, LoadingState, PanelMenu, PanelMenuItem, StatusBadge, StudioLayout, WorkspaceFrame, WorkspaceTopNavigation } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import "./lead-flow-page.css";

const COMMERCIAL_TYPE_ID = "commercial";
const LEAD_FLOW_NODE_KIND = "lead-state";
const MAIN_LANE_Y = 80;
const STEP_X = 306;
const MAX_PER_ROW = 6;
const ROW_SPACING = 220;

type LeadFlowNodeKind = typeof LEAD_FLOW_NODE_KIND;

interface LeadFlowNodeData extends Record<string, unknown> {
  label: string;
  statusId: string;
  color: string;
  count: number;
  value: number;
  isCurrent: boolean;
  isDone: boolean;
  isNext: boolean;
  isFirst: boolean;
  isTerminal: boolean;
  isOutcome: boolean;
  selectedLeadTitle: string;
}

type LeadFlowNode = Node<LeadFlowNodeData, LeadFlowNodeKind>;

function getTextField(task: Task, fieldId: string): string {
  const value = task.customFields[fieldId];
  return typeof value === "string" ? value.trim() : "";
}

function getNumberField(task: Task, fieldId: string): number {
  const value = task.customFields[fieldId];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getLeadSubtitle(task: Task): string {
  return getTextField(task, "companyName") || getTextField(task, "clientName") || getTextField(task, "contactName") || task.text || "Lead comercial";
}

function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? "L"}${parts[1]?.[0] ?? parts[0]?.[1] ?? "D"}`.toUpperCase();
}

function ensureStatuses(boardStatuses: TaskStatus[], tasks: Task[]): TaskStatus[] {
  const known = new Set(boardStatuses.map((status) => status.id));
  const missing = tasks
    .map((task) => task.status)
    .filter((statusId, index, values) => !known.has(statusId) && values.indexOf(statusId) === index)
    .map((statusId) => ({
      id: statusId,
      label: statusId,
      dot: "var(--text-secondary)"
    }));

  return [...boardStatuses, ...missing];
}

function isOutcomeStatus(status: TaskStatus): boolean {
  const value = `${status.id} ${status.label}`.toLowerCase();
  return (
    value.includes("lost") ||
    value.includes("perdido") ||
    value.includes("closed") ||
    value.includes("encerrado") ||
    value.includes("cancel")
  );
}

function LeadStateNode({ data, selected }: NodeProps) {
  const nodeData = data as LeadFlowNodeData;
  const preview = nodeData.isCurrent
    ? "Lead selecionado esta aqui"
    : nodeData.isOutcome
      ? "Desfecho alternativo"
      : nodeData.isDone
      ? "Etapa ja percorrida"
      : nodeData.isNext
        ? "Proximo passo provavel"
        : "Ainda nao alcancado";

  return (
    <div
      className={cn("lead-flow-node", nodeData.isCurrent && "lead-flow-node--current")}
      style={{ "--lead-flow-node-color": nodeData.color } as CSSProperties}
    >
      <FlowNodeCard
        kind={LEAD_FLOW_NODE_KIND}
        typeLabel={nodeData.isOutcome ? "Desfecho" : nodeData.isCurrent ? "Estado atual" : "Etapa"}
        label={nodeData.label}
        meta={`${nodeData.count} lead${nodeData.count === 1 ? "" : "s"} - ${formatMoneyCompact(nodeData.value)}`}
        preview={preview}
        icon={<AppIcon name={nodeData.isCurrent ? "trend-up" : nodeData.isDone ? "check" : nodeData.isOutcome ? "arrow-left" : "layers"} />}
        selected={selected || nodeData.isCurrent}
        target={!nodeData.isFirst}
        source={!nodeData.isTerminal}
      />
      {nodeData.isCurrent ? <span className="lead-flow-node__badge">Atual</span> : null}
    </div>
  );
}

const nodeTypes = {
  [LEAD_FLOW_NODE_KIND]: LeadStateNode
};

export function LeadFlowPage() {
  const { snapshot, isLoading } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedLeadId = searchParams.get("leadId") ?? "";
  const search = searchParams.get("q") ?? "";

  const metrics = useMemo(() => buildBoardMetrics(snapshot?.tasks ?? []), [snapshot?.tasks]);
  const boardStatuses = snapshot?.boardConfig.statuses ?? [];
  const commercialType =
    snapshot?.boardConfig.taskTypes.find((type) => type.id === COMMERCIAL_TYPE_ID) ??
    snapshot?.boardConfig.taskTypes.find((type) => type.label.toLowerCase().includes("comercial"));
  const commercialTypeId = commercialType?.id ?? COMMERCIAL_TYPE_ID;

  const commercialTasks = useMemo(
    () => (snapshot?.tasks ?? []).filter((task) => task.type === commercialTypeId),
    [commercialTypeId, snapshot?.tasks]
  );

  const statuses = useMemo(
    () => ensureStatuses(boardStatuses, commercialTasks),
    [boardStatuses, commercialTasks]
  );

  const statusById = useMemo(
    () => new Map(statuses.map((status) => [status.id, status])),
    [statuses]
  );

  const flowStatusGroups = useMemo(() => {
    const primary = statuses.filter((status) => !isOutcomeStatus(status));
    const outcomes = statuses.filter(isOutcomeStatus);
    return {
      primary: primary.length > 0 ? primary : statuses,
      outcomes: primary.length > 0 ? outcomes : []
    };
  }, [statuses]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return commercialTasks;
    }

    return commercialTasks.filter((task) =>
      [
        task.title,
        task.text,
        getLeadSubtitle(task),
        getTextField(task, "contactEmail"),
        getTextField(task, "source"),
        statusById.get(task.status)?.label
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [commercialTasks, search, statusById]);

  const selectedLead = useMemo(
    () => commercialTasks.find((task) => task.id === selectedLeadId) ?? filteredLeads[0] ?? commercialTasks[0] ?? null,
    [commercialTasks, filteredLeads, selectedLeadId]
  );

  useEffect(() => {
    if (!selectedLead || selectedLeadId === selectedLead.id) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("leadId", selectedLead.id);
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, selectedLead, selectedLeadId, setSearchParams]);

  const primaryIndexById = useMemo(
    () => new Map(flowStatusGroups.primary.map((status, index) => [status.id, index])),
    [flowStatusGroups.primary]
  );

  const leadValueByStatus = useMemo(() => {
    const values = new Map<string, { count: number; value: number }>();
    for (const status of statuses) {
      values.set(status.id, { count: 0, value: 0 });
    }

    for (const task of commercialTasks) {
      const current = values.get(task.status) ?? { count: 0, value: 0 };
      current.count += 1;
      current.value += getNumberField(task, "estimatedValue");
      values.set(task.status, current);
    }

    return values;
  }, [commercialTasks, statuses]);

  const isSelectedOutcome = selectedLead ? flowStatusGroups.outcomes.some((status) => status.id === selectedLead.status) : false;
  const branchSourceIndex = Math.max(0, flowStatusGroups.primary.length - 2);
  const currentPrimaryIndex = selectedLead
    ? primaryIndexById.get(selectedLead.status) ?? (isSelectedOutcome ? branchSourceIndex : -1)
    : -1;
  const branchSourceId = flowStatusGroups.primary[branchSourceIndex]?.id ?? flowStatusGroups.primary[0]?.id;

  const nodes = useMemo<LeadFlowNode[]>(() => {
    const mainNodes = flowStatusGroups.primary.map((status, index) => {
      const totals = leadValueByStatus.get(status.id) ?? { count: 0, value: 0 };
      const isCurrent = selectedLead?.status === status.id;
      const isDone = currentPrimaryIndex >= 0 && index < currentPrimaryIndex;
      const isNext = currentPrimaryIndex >= 0 && index === currentPrimaryIndex + 1 && !isSelectedOutcome;
      const col = index % MAX_PER_ROW;
      const row = Math.floor(index / MAX_PER_ROW);
      return {
        id: status.id,
        type: LEAD_FLOW_NODE_KIND as LeadFlowNodeKind,
        position: {
          x: col * STEP_X,
          y: MAIN_LANE_Y + row * ROW_SPACING
        },
        draggable: false,
        selectable: true,
        data: {
          label: status.label,
          statusId: status.id,
          color: status.dot || "var(--text-secondary)",
          count: totals.count,
          value: totals.value,
          isCurrent,
          isDone,
          isNext,
          isFirst: index === 0,
          isTerminal: index === flowStatusGroups.primary.length - 1 && !(flowStatusGroups.outcomes.length > 0 && status.id === branchSourceId),
          isOutcome: false,
          selectedLeadTitle: selectedLead?.title ?? ""
        }
      };
    });

    const branchSourceCol = branchSourceIndex % MAX_PER_ROW;
    const branchSourceRow = Math.floor(branchSourceIndex / MAX_PER_ROW);
    const outcomeY = MAIN_LANE_Y + (branchSourceRow + 1) * ROW_SPACING;
    const outcomeBaseX = Math.max(0, branchSourceCol - 1) * STEP_X;

    const outcomeNodes = flowStatusGroups.outcomes.map((status, index) => {
      const totals = leadValueByStatus.get(status.id) ?? { count: 0, value: 0 };
      const isCurrent = selectedLead?.status === status.id;
      return {
        id: status.id,
        type: LEAD_FLOW_NODE_KIND as LeadFlowNodeKind,
        position: {
          x: outcomeBaseX + index * STEP_X,
          y: outcomeY
        },
        draggable: false,
        selectable: true,
        data: {
          label: status.label,
          statusId: status.id,
          color: status.dot || "var(--danger)",
          count: totals.count,
          value: totals.value,
          isCurrent,
          isDone: false,
          isNext: currentPrimaryIndex >= branchSourceIndex,
          isFirst: false,
          isTerminal: true,
          isOutcome: true,
          selectedLeadTitle: selectedLead?.title ?? ""
        }
      };
    });

    return [...mainNodes, ...outcomeNodes];
  }, [
    branchSourceIndex,
    branchSourceId,
    currentPrimaryIndex,
    flowStatusGroups.outcomes,
    flowStatusGroups.primary,
    isSelectedOutcome,
    leadValueByStatus,
    selectedLead
  ]);

  const edges = useMemo<Edge[]>(() => {
    const primaryEdges = flowStatusGroups.primary.slice(0, -1).map((status, index) => {
      const nextStatus = flowStatusGroups.primary[index + 1];
      const isActivePath = currentPrimaryIndex > index;
      const isCurrentTransition = currentPrimaryIndex === index + 1 && !isSelectedOutcome;
      const color = isActivePath || isCurrentTransition
        ? "var(--lead-flow-accent)"
        : "color-mix(in oklab, var(--lead-flow-line) 78%, transparent)";

      return {
        id: `${status.id}-${nextStatus.id}`,
        source: status.id,
        target: nextStatus.id,
        type: "smoothstep",
        animated: isCurrentTransition,
        style: {
          stroke: color,
          strokeWidth: isActivePath || isCurrentTransition ? 2.6 : 1.8
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color
        }
      };
    });

    const outcomeEdges = branchSourceId
      ? flowStatusGroups.outcomes.map((status) => {
          const isActive = selectedLead?.status === status.id;
          const color = isActive ? "var(--lead-flow-accent)" : "color-mix(in oklab, var(--lead-flow-line) 70%, transparent)";
          return {
            id: `${branchSourceId}-${status.id}`,
            source: branchSourceId,
            target: status.id,
            type: "smoothstep",
            animated: isActive,
            style: {
              stroke: color,
              strokeDasharray: isActive ? undefined : "7 7",
              strokeWidth: isActive ? 2.6 : 1.6
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 14,
              height: 14,
              color
            }
          } satisfies Edge;
        })
      : [];

    return [...primaryEdges, ...outcomeEdges];
  }, [
    branchSourceId,
    currentPrimaryIndex,
    flowStatusGroups.outcomes,
    flowStatusGroups.primary,
    isSelectedOutcome,
    selectedLead?.status
  ]);

  const handleSearchChange = useCallback((value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value.trim()) {
      nextParams.set("q", value);
    } else {
      nextParams.delete("q");
    }
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleSelectLead = useCallback((taskId: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("leadId", taskId);
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const noopNodesChange = useCallback<OnNodesChange<LeadFlowNode>>(() => undefined, []);
  const noopEdgesChange = useCallback<OnEdgesChange<Edge>>(() => undefined, []);

  const currentStatus = selectedLead ? statusById.get(selectedLead.status) : null;
  const selectedLeadValue = selectedLead ? getNumberField(selectedLead, "estimatedValue") : 0;

  const topNavigation = (
    <WorkspaceTopNavigation<"flow">
      value="flow"
      items={[{ id: "flow", label: "Fluxo de Leads" }]}
      onChange={() => undefined}
      ariaLabel="Fluxo de Leads"
    />
  );

  return (
    <AppShell metrics={metrics} noPageScroll hideSidebarBrandMark hidePageHeader topNavigation={topNavigation}>
      <WorkspaceFrame className="lead-flow-page" variant="canvas" scroll="none">
        <LoadingState text="Carregando fluxo de leads..." animation="leads" variant="frame" visible={isLoading && !snapshot} />

        <StudioLayout
          sidebar={
            <PanelMenu
              title="Leads"
              count={filteredLeads.length}
              search={search}
              onSearchChange={handleSearchChange}
              searchPlaceholder="Empresa, contato ou status..."
              footer={
                <div className="lf-sidebar-foot">
                  <div>
                    <span>Status atual</span>
                    <strong>{currentStatus?.label ?? selectedLead?.status ?? "-"}</strong>
                  </div>
                  <div>
                    <span>Valor estimado</span>
                    <strong>{formatMoneyCompact(selectedLeadValue)}</strong>
                  </div>
                </div>
              }
            >
              {filteredLeads.map((task) => {
                const status = statusById.get(task.status);
                const isSelected = selectedLead?.id === task.id;
                return (
                  <PanelMenuItem
                    key={task.id}
                    selected={isSelected}
                    onClick={() => handleSelectLead(task.id)}
                    leading={
                      <span className="lf-lead-avatar" style={{ borderColor: status?.dot ?? "var(--lead-flow-accent)" }}>
                        {getInitials(task.title)}
                      </span>
                    }
                    label={task.title}
                    meta={
                      <>
                        <span className="lf-stage-dot" style={{ background: status?.dot ?? "var(--lead-flow-accent)" }} />
                        {status?.label ?? task.status}
                      </>
                    }
                  />
                );
              })}

              {filteredLeads.length === 0 ? (
                <EmptyState size="compact">Nenhum lead comercial encontrado.</EmptyState>
              ) : null}
            </PanelMenu>
          }
          sidebarWidth={280}
        >
          <FlowCanvas<LeadFlowNodeData, LeadFlowNodeKind>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            paletteItems={[]}
            onNodesChange={noopNodesChange}
            onEdgesChange={noopEdgesChange}
            onEdgesAdd={() => undefined}
            onNodesAdd={() => undefined}
            onNodeSelect={() => undefined}
            fitViewKey={selectedLead ? nodes.length + currentPrimaryIndex + selectedLead.id.length : nodes.length}
            emptyHint="Nenhum estado configurado."
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            className="lf-canvas"
          />
        </StudioLayout>
      </WorkspaceFrame>
    </AppShell>
  );
}
