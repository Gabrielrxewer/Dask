import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { MarkerType, type Edge, type Node, type NodeProps, type OnEdgesChange, type OnNodesChange } from "@xyflow/react";
import { useParams, useSearchParams } from "react-router-dom";
import { buildBoardMetrics, type BoardLeadOperationalMetadata, type Task, type TaskStatus } from "@/entities/task";
import { flattenWorkItemPages, useLeadsQuery, useMoveLeadInFlowMutation, useSignalsQuery } from "@/modules/leads";
import { useWorkspace } from "@/modules/workspace";
import { formatMoneyCompact } from "@/shared/lib/money";
import { cn } from "@/shared/lib/cn";
import { AppIcon, EmptyState, FlowCanvas, FlowNodeCard, LoadingState, PanelMenu, StudioLayout, WorkspaceFrame, WorkspaceTopNavigation } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { createLeadFlowMoveCommand, isLeadFlowReadonly } from "../model";
import "./lead-flow-page.css";

const LEAD_FLOW_NODE_KIND = "lead-state";
const LEAD_FLOW_DRAG_TYPE = "lead-flow-work-item";
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
  canDrop: boolean;
  isSaving: boolean;
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

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function resolveConfiguredStatusGroups(
  metadata: BoardLeadOperationalMetadata | null,
  statusById: Map<string, TaskStatus>
): { primary: TaskStatus[]; outcomes: TaskStatus[]; terminalStatusIds: Set<string> } {
  if (!metadata) {
    return { primary: [], outcomes: [], terminalStatusIds: new Set() };
  }

  const primaryIds = uniqueValues(metadata.funnel.flatMap((stage) => stage.statusIds));
  const primaryIdSet = new Set(primaryIds);
  const outcomeIds = uniqueValues(metadata.terminalStatusIds.filter((statusId) => !primaryIdSet.has(statusId)));

  return {
    primary: primaryIds.map((statusId) => statusById.get(statusId)).filter((status): status is TaskStatus => Boolean(status)),
    outcomes: outcomeIds.map((statusId) => statusById.get(statusId)).filter((status): status is TaskStatus => Boolean(status)),
    terminalStatusIds: new Set(metadata.terminalStatusIds)
  };
}

function LeadStateNode({ data, selected }: NodeProps) {
  const nodeData = data as LeadFlowNodeData;
  const { isOver, setNodeRef } = useDroppable({
    id: nodeData.statusId,
    disabled: !nodeData.canDrop,
    data: {
      type: "lead-flow-status",
      statusId: nodeData.statusId
    }
  });
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
      ref={setNodeRef}
      className={cn(
        "lead-flow-node",
        nodeData.isCurrent && "lead-flow-node--current",
        nodeData.canDrop && "lead-flow-node--drop-target",
        isOver && "lead-flow-node--drag-over",
        nodeData.isSaving && "lead-flow-node--saving"
      )}
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

interface LeadFlowSidebarItemProps {
  task: Task;
  status: TaskStatus | undefined;
  selected: boolean;
  canDrag: boolean;
  onSelect: (taskId: string) => void;
}

function LeadFlowSidebarItem({ task, status, selected, canDrag, onSelect }: LeadFlowSidebarItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `lead-flow:${task.id}`,
    disabled: !canDrag,
    data: {
      type: LEAD_FLOW_DRAG_TYPE,
      leadId: task.id
    }
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn(
        "panel-menu-item",
        "panel-menu-item--default",
        "lf-lead-draggable",
        selected && "panel-menu-item--selected",
        canDrag && "panel-menu-item--draggable",
        isDragging && "lf-lead-draggable--dragging"
      )}
      style={{ transform: CSS.Translate.toString(transform) }}
      onClick={() => onSelect(task.id)}
      {...attributes}
      {...listeners}
      aria-pressed={selected}
    >
      <span className="panel-menu-item__leading">
        <span className="lf-lead-avatar" style={{ borderColor: status?.dot ?? "var(--lead-flow-accent)" }}>
          {getInitials(task.title)}
        </span>
      </span>
      <span className="panel-menu-item__body">
        <span className="panel-menu-item__label-row">
          <span className="panel-menu-item__label">{task.title}</span>
        </span>
        <span className="panel-menu-item__meta">
          <span className="lf-stage-dot" style={{ background: status?.dot ?? "var(--lead-flow-accent)" }} />
          {status?.label ?? task.status}
        </span>
      </span>
    </button>
  );
}

export function LeadFlowPage() {
  const { snapshot, isLoading } = useWorkspace();
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const selectedLeadId = searchParams.get("leadId") ?? "";
  const search = searchParams.get("q") ?? "";

  const workspaceIdentifier = snapshot?.key ?? snapshot?.workspace?.key ?? snapshot?.id ?? null;
  const moveLeadInFlowMutation = useMoveLeadInFlowMutation(workspaceIdentifier);
  const boardStatuses = snapshot?.boardConfig.statuses ?? [];
  const leadMetadata = snapshot?.boardConfig.operationalMetadata?.leads ?? null;
  const leadTypeId = leadMetadata?.defaultItemTypeId ?? "";
  const signalTypeId = leadMetadata?.prospecting?.itemTypeIds?.[0] ?? "";
  const leadsQuery = useLeadsQuery(workspaceSlug || workspaceIdentifier, leadTypeId || null, {
    limit: 100,
    sort: "position_asc"
  });
  const signalsQuery = useSignalsQuery(workspaceSlug || workspaceIdentifier, signalTypeId || null, {
    limit: 100,
    sort: "position_asc"
  });
  const pagedLeads = useMemo(() => flattenWorkItemPages(leadsQuery.data), [leadsQuery.data]);
  const pagedSignals = useMemo(() => flattenWorkItemPages(signalsQuery.data), [signalsQuery.data]);
  const boardStatusById = useMemo(
    () => new Map(boardStatuses.map((status) => [status.id, status])),
    [boardStatuses]
  );

  const commercialTasks = useMemo(
    () => {
      if (!leadMetadata) return [];
      if (leadsQuery.data || signalsQuery.data) {
        return [...pagedSignals, ...pagedLeads];
      }

      const commercialTypeIds = new Set(leadMetadata.itemTypeIds);
      return (snapshot?.tasks ?? []).filter((task) => commercialTypeIds.has(task.type));
    },
    [leadMetadata, leadsQuery.data, pagedLeads, pagedSignals, signalsQuery.data, snapshot?.tasks]
  );
  const metrics = useMemo(() => buildBoardMetrics(commercialTasks), [commercialTasks]);

  useEffect(() => {
    if (leadsQuery.hasNextPage && !leadsQuery.isFetchingNextPage) {
      void leadsQuery.fetchNextPage();
    }
  }, [leadsQuery.fetchNextPage, leadsQuery.hasNextPage, leadsQuery.isFetchingNextPage]);

  useEffect(() => {
    if (signalsQuery.hasNextPage && !signalsQuery.isFetchingNextPage) {
      void signalsQuery.fetchNextPage();
    }
  }, [signalsQuery.fetchNextPage, signalsQuery.hasNextPage, signalsQuery.isFetchingNextPage]);

  const statusById = useMemo(
    () => boardStatusById,
    [boardStatusById]
  );

  const flowStatusGroups = useMemo(
    () => resolveConfiguredStatusGroups(leadMetadata, statusById),
    [leadMetadata, statusById]
  );
  const flowStatuses = useMemo(
    () => [...flowStatusGroups.primary, ...flowStatusGroups.outcomes],
    [flowStatusGroups.outcomes, flowStatusGroups.primary]
  );

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
  const canEditLeadFlow = Boolean(selectedLead && !isLeadFlowReadonly(snapshot?.access));

  const handleMoveLeadToStatus = useCallback((statusId: string | null, leadId?: string) => {
    if (!statusId || !canEditLeadFlow || moveLeadInFlowMutation.isPending) return;
    const targetLead = leadId
      ? commercialTasks.find((task) => task.id === leadId)
      : selectedLead;
    if (!targetLead) return;
    const command = createLeadFlowMoveCommand(targetLead, statusId);
    if (!command) return;
    moveLeadInFlowMutation.mutate(command);
  }, [canEditLeadFlow, commercialTasks, moveLeadInFlowMutation, selectedLead]);

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
    for (const status of flowStatuses) {
      values.set(status.id, { count: 0, value: 0 });
    }

    for (const task of commercialTasks) {
      const current = values.get(task.status) ?? { count: 0, value: 0 };
      current.count += 1;
      current.value += getNumberField(task, "estimatedValue");
      values.set(task.status, current);
    }

    return values;
  }, [commercialTasks, flowStatuses]);

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
          isTerminal: flowStatusGroups.terminalStatusIds.has(status.id) ||
            (index === flowStatusGroups.primary.length - 1 && !(flowStatusGroups.outcomes.length > 0 && status.id === branchSourceId)),
          isOutcome: false,
          selectedLeadTitle: selectedLead?.title ?? "",
          canDrop: canEditLeadFlow && !isCurrent && !moveLeadInFlowMutation.isPending,
          isSaving: moveLeadInFlowMutation.isPending
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
          selectedLeadTitle: selectedLead?.title ?? "",
          canDrop: canEditLeadFlow && !isCurrent && !moveLeadInFlowMutation.isPending,
          isSaving: moveLeadInFlowMutation.isPending
        }
      };
    });

    return [...mainNodes, ...outcomeNodes];
  }, [
    branchSourceIndex,
    branchSourceId,
    canEditLeadFlow,
    currentPrimaryIndex,
    flowStatusGroups.outcomes,
    flowStatusGroups.primary,
    flowStatusGroups.terminalStatusIds,
    isSelectedOutcome,
    leadValueByStatus,
    moveLeadInFlowMutation.isPending,
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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const leadId = typeof event.active.data.current?.leadId === "string"
      ? event.active.data.current.leadId
      : null;
    setDraggingLeadId(leadId);
    if (leadId && leadId !== selectedLeadId) {
      handleSelectLead(leadId);
    }
  }, [handleSelectLead, selectedLeadId]);

  const clearDraggingLead = useCallback((_event?: DragCancelEvent) => {
    setDraggingLeadId(null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const leadId = typeof event.active.data.current?.leadId === "string"
      ? event.active.data.current.leadId
      : undefined;
    const statusId = typeof event.over?.data.current?.statusId === "string"
      ? event.over.data.current.statusId
      : typeof event.over?.id === "string"
        ? event.over.id
        : null;

    handleMoveLeadToStatus(statusId, leadId);
    setDraggingLeadId(null);
  }, [handleMoveLeadToStatus]);

  const noopNodesChange = useCallback<OnNodesChange<LeadFlowNode>>(() => undefined, []);
  const noopEdgesChange = useCallback<OnEdgesChange<Edge>>(() => undefined, []);

  const currentStatus = selectedLead ? statusById.get(selectedLead.status) : null;
  const selectedLeadValue = selectedLead ? getNumberField(selectedLead, "estimatedValue") : 0;
  const currentStatusNodeId = selectedLead?.status ?? null;
  const handleMoveSelectedLeadToStatus = useCallback((statusId: string | null) => {
    handleMoveLeadToStatus(statusId);
  }, [handleMoveLeadToStatus]);

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

        {!isLoading && snapshot && !leadMetadata ? (
          <EmptyState className="lead-flow-page__empty" size="compact">
            Template comercial sem metadados operacionais de leads.
          </EmptyState>
        ) : null}

        {leadMetadata ? (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={clearDraggingLead}>
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
                  <div>
                    <span>Edicao</span>
                    <strong>{canEditLeadFlow ? moveLeadInFlowMutation.isPending ? "Salvando..." : "Interativa" : "Somente leitura"}</strong>
                  </div>
                </div>
              }
            >
              {filteredLeads.map((task) => {
                const status = statusById.get(task.status);
                const isSelected = selectedLead?.id === task.id;
                return (
                  <LeadFlowSidebarItem
                    key={task.id}
                    task={task}
                    status={status}
                    selected={isSelected}
                    canDrag={canEditLeadFlow}
                    onSelect={handleSelectLead}
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
            onNodeSelect={handleMoveSelectedLeadToStatus}
            fitViewKey={selectedLead ? nodes.length + currentPrimaryIndex + selectedLead.id.length : nodes.length}
            focusNodeId={currentStatusNodeId}
            emptyHint="Nenhum estado configurado."
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={canEditLeadFlow}
            showMiniMap
            className="lf-canvas"
          />
        </StudioLayout>
          <DragOverlay>
            {draggingLeadId ? (
              <div className="lf-drag-overlay">
                {commercialTasks.find((task) => task.id === draggingLeadId)?.title ?? "Lead"}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        ) : null}
      </WorkspaceFrame>
    </AppShell>
  );
}
