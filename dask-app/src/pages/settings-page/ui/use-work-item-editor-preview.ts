import { useMemo } from "react";
import { buildTaskFieldBindingsForType } from "@/entities/task";
import type { BoardConfig, Task, TaskFieldBinding, TaskFieldCardArea, TaskFieldDefinition } from "@/entities/task";
import type { ApiBoardColumn, ApiItemType, ApiWorkflowState, WorkspaceSnapshot } from "@/modules/workspace/model";
import { withCssColorAlpha } from "@/shared/lib/color/css-color";
import type { DetailZone, LayoutDraft } from "@/pages/settings-page/model/work-item-layout-editor";
import { buildBoardColumnsRuntimeView, mapTasksForBoardPerspective } from "@/widgets/board-columns/model/board-runtime";
import {
  buildPreviewTask,
  DEFAULT_TYPE_COLOR,
  PREVIEW_ASSIGNEE,
  PREVIEW_CREATED_BY,
  type FieldLibraryItem
} from "./work-item-editor-settings.model";

interface UseWorkItemEditorPreviewInput {
  activeType: ApiItemType | null;
  activeLayout: LayoutDraft;
  activeDetailZones: Record<string, DetailZone>;
  activeCardAreaDrafts: Record<string, TaskFieldCardArea>;
  allFields: TaskFieldDefinition[];
  libraryFields: FieldLibraryItem[];
  boardConfig: BoardConfig;
  boardColumns: ApiBoardColumn[];
  workflowStates: ApiWorkflowState[];
  snapshot: WorkspaceSnapshot | null | undefined;
}

export function useWorkItemEditorPreview({
  activeType,
  activeLayout,
  activeDetailZones,
  activeCardAreaDrafts,
  allFields,
  libraryFields,
  boardConfig,
  boardColumns,
  workflowStates,
  snapshot
}: UseWorkItemEditorPreviewInput) {
  const typeColor = activeType?.color || DEFAULT_TYPE_COLOR;
  const previewTypeId = activeType?.slug ?? boardConfig.taskTypes[0]?.id ?? "preview-type";
  const previewTypeLabel = activeType?.name ?? boardConfig.taskTypes.find((t) => t.id === previewTypeId)?.label ?? "Tipo";
  const previewTypeColor =
    activeType?.color ?? boardConfig.taskTypes.find((t) => t.id === previewTypeId)?.text ?? DEFAULT_TYPE_COLOR;

  const previewPerspectives = useMemo<BoardConfig["perspectives"]>(() => {
    if (Array.isArray((boardConfig as { perspectives?: unknown }).perspectives)) {
      return (boardConfig as { perspectives: BoardConfig["perspectives"] }).perspectives;
    }
    if (Array.isArray((boardConfig as { views?: unknown }).views)) {
      return (boardConfig as { views: BoardConfig["perspectives"] }).views;
    }
    return [];
  }, [boardConfig]);

  const previewBoardMode = snapshot?.preferences.defaultBoardMode ?? previewPerspectives[0]?.id ?? "dev";
  const previewPerspective = previewPerspectives.find((p) => p.id === previewBoardMode) ?? previewPerspectives[0] ?? null;

  const previewProjectedTasks = useMemo(
    () => mapTasksForBoardPerspective(snapshot?.tasks ?? [], previewPerspective),
    [previewPerspective, snapshot?.tasks]
  );

  const previewBoardColumnsPerspective = useMemo(
    () =>
      previewPerspective?.statusSource.kind === "workflow_state"
        ? buildBoardColumnsRuntimeView(previewProjectedTasks, boardColumns, workflowStates, previewPerspective?.visibleBoardColumnIds)
        : null,
    [boardColumns, previewPerspective, previewProjectedTasks, workflowStates]
  );

  const previewRuntimeStatuses = previewBoardColumnsPerspective?.statuses ?? previewPerspective?.statuses ?? boardConfig.statuses;
  const previewRuntimeTasks = previewBoardColumnsPerspective?.tasks ?? previewProjectedTasks;
  const previewSourceTask = useMemo(
    () => previewRuntimeTasks.find((task) => task.type === previewTypeId) ?? null,
    [previewRuntimeTasks, previewTypeId]
  );
  const previewStatus =
    previewRuntimeStatuses.find((s) => s.id === previewSourceTask?.status) ??
    previewRuntimeStatuses[0] ??
    { id: "preview-status", label: "Em validacao", dot: DEFAULT_TYPE_COLOR };

  const previewTaskTypes = useMemo(() => {
    const meta = {
      id: previewTypeId,
      label: previewTypeLabel,
      background: withCssColorAlpha(previewTypeColor, 10),
      border: withCssColorAlpha(previewTypeColor, 40),
      text: previewTypeColor
    };
    if (boardConfig.taskTypes.some((t) => t.id === previewTypeId)) {
      return boardConfig.taskTypes.map((t) => (t.id === previewTypeId ? { ...t, ...meta } : t));
    }
    return [...boardConfig.taskTypes, meta];
  }, [boardConfig.taskTypes, previewTypeColor, previewTypeId, previewTypeLabel]);

  const previewFieldBindings = useMemo<TaskFieldBinding[]>(() => {
    if (!activeType) return Array.isArray(boardConfig.fieldBindings) ? boardConfig.fieldBindings : [];
    const otherTypeBindings = Array.isArray(boardConfig.fieldBindings)
      ? boardConfig.fieldBindings.filter((binding) => binding.typeId !== activeType.slug)
      : [];
    const rawActiveBindings = buildTaskFieldBindingsForType({
      typeId: activeType.slug,
      fieldDefinitions: allFields,
      fieldBindings: boardConfig.fieldBindings,
      cardFieldIds: activeLayout.card,
      detailFieldIds: activeLayout.detail,
      detailZonesByFieldId: activeDetailZones
    });
    const activeBindings = rawActiveBindings.map((binding) => {
      if (binding.displayContext !== "card") return binding;
      const areaOverride = activeCardAreaDrafts[binding.fieldId];
      if (!areaOverride) return binding;
      return { ...binding, settings: { ...(binding.settings ?? {}), cardArea: areaOverride } };
    });
    return [...otherTypeBindings, ...activeBindings];
  }, [activeCardAreaDrafts, activeDetailZones, activeLayout.card, activeLayout.detail, activeType, allFields, boardConfig.fieldBindings]);

  const previewBoardConfig = useMemo<BoardConfig>(
    () => ({ ...boardConfig, taskTypes: previewTaskTypes, fieldDefinitions: allFields, fieldBindings: previewFieldBindings }),
    [allFields, boardConfig, previewFieldBindings, previewTaskTypes]
  );

  const previewTask = useMemo<Task>(
    () =>
      buildPreviewTask({
        fields: libraryFields,
        typeId: previewTypeId,
        statusId: previewStatus.id,
        sourceTask: previewSourceTask
      }),
    [libraryFields, previewSourceTask, previewStatus.id, previewTypeId]
  );

  const previewMembersById = useMemo(
    () => ({ ...(snapshot?.membersById ?? {}), [PREVIEW_CREATED_BY.id]: PREVIEW_CREATED_BY, [PREVIEW_ASSIGNEE.id]: PREVIEW_ASSIGNEE }),
    [snapshot?.membersById]
  );

  return {
    typeColor,
    previewStatus,
    previewTask,
    previewBoardConfig,
    previewMembersById,
    previewRuntimeStatuses
  };
}
