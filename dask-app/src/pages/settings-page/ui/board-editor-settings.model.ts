import type { ApiBoardColumn, BoardTemplatePerspective, BoardTemplateSummary } from "@/modules/workspace/model";

export type PerspectiveStatus = { id: string; label: string; dot: string };

export type PerspectiveStatusSource =
  | { kind: "workflow_state" }
  | { kind: "custom_field"; fieldId: string; fallbackByStatus?: Record<string, string> };

export type PerspectiveTemplateMeta = {
  templateId: string;
  templateName: string;
  perspectiveKey: string;
  perspectiveName: string;
};

export type BoardPerspective = {
  id: string;
  label: string;
  caption?: string;
  statuses: PerspectiveStatus[];
  statusSource: PerspectiveStatusSource;
  allowedTaskTypes?: string[];
  compactCards?: boolean;
  visibleBoardColumnIds?: string[];
  createTaskColumnIds?: string[];
  template?: PerspectiveTemplateMeta;
};

export type PerspectiveTemplateSeed = {
  key: string;
  templateId: string;
  templateName: string;
  templateDescription?: string | null;
  perspectiveKey: string;
  perspectiveName: string;
  caption?: string;
  statuses: PerspectiveStatus[];
  statusSource: PerspectiveStatusSource;
  allowedTaskTypes?: string[];
  compactCards?: boolean;
  visibleBoardColumnSlugs?: string[];
  visibleBoardColumnIds?: string[];
  createTaskColumnSlugs?: string[];
  createTaskColumnIds?: string[];
};

export type BoardAddColumnMode = null | "pick" | "new";

export function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function cloneStatuses(statuses: PerspectiveStatus[]): PerspectiveStatus[] {
  return statuses.map((status) => ({ ...status }));
}

export function cloneStatusSource(source: PerspectiveStatusSource): PerspectiveStatusSource {
  if (source.kind === "custom_field") {
    return {
      kind: "custom_field",
      fieldId: source.fieldId,
      fallbackByStatus: source.fallbackByStatus ? { ...source.fallbackByStatus } : undefined
    };
  }

  return { kind: "workflow_state" };
}

export function resolvePerspectives(rawBoardConfig: unknown, baseStatuses: PerspectiveStatus[]): BoardPerspective[] {
  if (rawBoardConfig && typeof rawBoardConfig === "object") {
    const cfg = rawBoardConfig as Record<string, unknown>;
    if (Array.isArray(cfg.perspectives) && cfg.perspectives.length > 0) {
      return cfg.perspectives as BoardPerspective[];
    }
    if (Array.isArray(cfg.views) && cfg.views.length > 0) {
      return cfg.views as BoardPerspective[];
    }
  }
  return [{ id: "dev", label: "DEV", statuses: baseStatuses, statusSource: { kind: "workflow_state" } }];
}

export function serializePerspective(perspective: BoardPerspective, position: number) {
  return {
    key: perspective.id,
    name: perspective.label,
    caption: perspective.caption,
    compactCards: Boolean(perspective.compactCards),
    position,
    allowedTaskTypes: perspective.allowedTaskTypes ?? [],
    visibleBoardColumnIds: perspective.visibleBoardColumnIds ?? [],
    createTaskColumnIds: perspective.createTaskColumnIds ?? [],
    statusSource: perspective.statusSource,
    statuses: perspective.statuses,
    template: perspective.template
  };
}

function normalizeTemplatePerspectiveStatusSource(
  rawSource: BoardTemplatePerspective["statusSource"]
): PerspectiveStatusSource {
  if (rawSource?.kind === "custom_field" && typeof rawSource.fieldId === "string" && rawSource.fieldId.trim()) {
    return {
      kind: "custom_field",
      fieldId: rawSource.fieldId,
      fallbackByStatus: rawSource.fallbackByStatus ? { ...rawSource.fallbackByStatus } : undefined
    };
  }

  return { kind: "workflow_state" };
}

export function extractTemplateSeeds(templates: BoardTemplateSummary[]): PerspectiveTemplateSeed[] {
  return templates.flatMap((template) => {
    const rawPerspectives = Array.isArray(template.schema?.perspectives) ? template.schema?.perspectives : [];
    const seeds = rawPerspectives.map((perspective, index): PerspectiveTemplateSeed | null => {
      if (!perspective || typeof perspective !== "object") {
        return null;
      }

      const perspectiveKey =
        typeof perspective.key === "string" && perspective.key.trim().length > 0
          ? perspective.key
          : `perspective-${index + 1}`;
      const perspectiveName =
        typeof perspective.name === "string" && perspective.name.trim().length > 0
          ? perspective.name
          : `Perspectiva ${index + 1}`;

      const statuses = Array.isArray(perspective.statuses)
        ? perspective.statuses
            .map((status) =>
              status &&
              typeof status === "object" &&
              typeof status.id === "string" &&
              typeof status.label === "string" &&
              typeof status.dot === "string"
                ? { id: status.id, label: status.label, dot: status.dot }
                : null
            )
            .filter((status): status is PerspectiveStatus => status !== null)
        : [];

      return {
        key: `${template.id}::${perspectiveKey}`,
        templateId: template.id,
        templateName: template.name,
        templateDescription: template.description ?? undefined,
        perspectiveKey,
        perspectiveName,
        caption: typeof perspective.caption === "string" ? perspective.caption : undefined,
        statuses,
        statusSource: normalizeTemplatePerspectiveStatusSource(perspective.statusSource),
        allowedTaskTypes: Array.isArray(perspective.allowedTaskTypes)
          ? perspective.allowedTaskTypes.filter((value): value is string => typeof value === "string")
          : undefined,
        compactCards: Boolean(perspective.compactCards),
        visibleBoardColumnSlugs: Array.isArray(perspective.visibleBoardColumnSlugs)
          ? perspective.visibleBoardColumnSlugs.filter((value): value is string => typeof value === "string")
          : undefined,
        visibleBoardColumnIds: Array.isArray(perspective.visibleBoardColumnIds)
          ? perspective.visibleBoardColumnIds.filter((value): value is string => typeof value === "string")
          : undefined,
        createTaskColumnSlugs: Array.isArray(perspective.createTaskColumnSlugs)
          ? perspective.createTaskColumnSlugs.filter((value): value is string => typeof value === "string")
          : undefined,
        createTaskColumnIds: Array.isArray(perspective.createTaskColumnIds)
          ? perspective.createTaskColumnIds.filter((value): value is string => typeof value === "string")
          : undefined
      };
    });

    return seeds.filter((seed): seed is PerspectiveTemplateSeed => seed !== null);
  });
}

function resolveVisibleColumnIdsFromSeed(seed: PerspectiveTemplateSeed, activeColumns: ApiBoardColumn[]): string[] {
  const columnIdBySlug = new Map(activeColumns.map((column) => [column.slug, column.id]));

  const fromSlugs = Array.isArray(seed.visibleBoardColumnSlugs)
    ? seed.visibleBoardColumnSlugs
        .map((slug) => columnIdBySlug.get(slug))
        .filter((columnId): columnId is string => Boolean(columnId))
    : [];

  if (fromSlugs.length > 0) {
    return Array.from(new Set(fromSlugs));
  }

  if (Array.isArray(seed.visibleBoardColumnIds) && seed.visibleBoardColumnIds.length > 0) {
    return Array.from(new Set(seed.visibleBoardColumnIds));
  }

  return activeColumns.map((column) => column.id);
}

function resolveCreateTaskColumnIdsFromSeed(seed: PerspectiveTemplateSeed, activeColumns: ApiBoardColumn[]): string[] {
  const columnIdBySlug = new Map(activeColumns.map((column) => [column.slug, column.id]));

  const fromSlugs = Array.isArray(seed.createTaskColumnSlugs)
    ? seed.createTaskColumnSlugs
        .map((slug) => columnIdBySlug.get(slug))
        .filter((columnId): columnId is string => Boolean(columnId))
    : [];

  if (fromSlugs.length > 0) {
    return Array.from(new Set(fromSlugs));
  }

  if (Array.isArray(seed.createTaskColumnIds)) {
    return Array.from(new Set(seed.createTaskColumnIds));
  }

  return [];
}

export function buildPerspectiveFromTemplateSeed(input: {
  seed: PerspectiveTemplateSeed;
  id: string;
  label: string;
  activeColumns: ApiBoardColumn[];
  fallbackStatuses: PerspectiveStatus[];
}): BoardPerspective {
  return {
    id: input.id,
    label: input.label,
    caption: input.seed.caption,
    statuses: cloneStatuses(input.seed.statuses.length > 0 ? input.seed.statuses : input.fallbackStatuses),
    statusSource: cloneStatusSource(input.seed.statusSource),
    allowedTaskTypes: input.seed.allowedTaskTypes ? [...input.seed.allowedTaskTypes] : undefined,
    compactCards: Boolean(input.seed.compactCards),
    visibleBoardColumnIds: resolveVisibleColumnIdsFromSeed(input.seed, input.activeColumns),
    createTaskColumnIds: resolveCreateTaskColumnIdsFromSeed(input.seed, input.activeColumns),
    template: {
      templateId: input.seed.templateId,
      templateName: input.seed.templateName,
      perspectiveKey: input.seed.perspectiveKey,
      perspectiveName: input.seed.perspectiveName
    }
  };
}
