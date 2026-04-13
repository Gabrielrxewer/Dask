import { useCallback, useEffect, useMemo, useState } from "react";
import { factoryBoardConfig } from "@/entities/task";
import { useWorkspace } from "@/modules/workspace";
import type { ApiBoardColumn } from "@/modules/workspace/model";
import { Button, FormField, Section, TextInput } from "@/shared/ui";
import "./perspectives-settings.css";

type PerspectiveStatusSource =
  | { kind: "workflow_state" }
  | { kind: "custom_field"; fieldId: string; fallbackByStatus?: Record<string, string> };

type PerspectiveStatus = { id: string; label: string; dot: string };

type BoardPerspective = {
  id: string;
  label: string;
  caption?: string;
  statuses: PerspectiveStatus[];
  statusSource: PerspectiveStatusSource;
  allowedTaskTypes?: string[];
  compactCards?: boolean;
  visibleBoardColumnIds?: string[];
};

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function serializePerspective(perspective: BoardPerspective, position: number) {
  return {
    key: perspective.id,
    name: perspective.label,
    caption: perspective.caption,
    compactCards: Boolean(perspective.compactCards),
    position,
    allowedTaskTypes: perspective.allowedTaskTypes ?? [],
    visibleBoardColumnIds: perspective.visibleBoardColumnIds ?? [],
    statusSource: perspective.statusSource,
    statuses: perspective.statuses
  };
}

function resolvePerspectives(rawBoardConfig: unknown): BoardPerspective[] {
  const fromPerspectives =
    rawBoardConfig &&
    typeof rawBoardConfig === "object" &&
    Array.isArray((rawBoardConfig as { perspectives?: unknown }).perspectives)
      ? ((rawBoardConfig as { perspectives: BoardPerspective[] }).perspectives ?? [])
      : [];

  if (fromPerspectives.length > 0) {
    return fromPerspectives;
  }

  const fromViews =
    rawBoardConfig &&
    typeof rawBoardConfig === "object" &&
    Array.isArray((rawBoardConfig as { views?: unknown }).views)
      ? ((rawBoardConfig as { views: BoardPerspective[] }).views ?? [])
      : [];

  return fromViews;
}

export function PerspectivesSettings() {
  const { snapshot, fetchBoardColumns, updatePreferences } = useWorkspace();

  const [columns, setColumns] = useState<ApiBoardColumn[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(true);
  const [newPerspectiveName, setNewPerspectiveName] = useState("");
  const [saving, setSaving] = useState(false);

  const boardConfig = snapshot?.boardConfig ?? factoryBoardConfig;
  const baseStatuses = boardConfig.statuses;

  const perspectives = useMemo(() => {
    const parsed = resolvePerspectives(boardConfig);
    if (parsed.length > 0) {
      return parsed;
    }

    return [
      {
        id: "dev",
        label: "DEV",
        statuses: baseStatuses,
        statusSource: { kind: "workflow_state" as const }
      }
    ];
  }, [boardConfig, baseStatuses]);

  const loadColumns = useCallback(async () => {
    setLoadingColumns(true);
    try {
      const list = await fetchBoardColumns();
      setColumns(list.filter(col => col.isActive).sort((a, b) => a.order - b.order));
    } finally {
      setLoadingColumns(false);
    }
  }, [fetchBoardColumns]);

  useEffect(() => {
    void loadColumns();
  }, [loadColumns]);

  const persistPerspectives = useCallback(
    async (nextPerspectives: BoardPerspective[], defaultBoardMode?: string) => {
      setSaving(true);
      try {
        await updatePreferences({
          ...(defaultBoardMode ? { defaultBoardMode } : {}),
          settings: {
            perspectives: nextPerspectives.map((perspective, position) => serializePerspective(perspective, position))
          }
        });
      } finally {
        setSaving(false);
      }
    },
    [updatePreferences]
  );

  const handleCreatePerspective = async () => {
    const normalizedName = newPerspectiveName.trim();
    if (!normalizedName) {
      return;
    }

    const baseId = toSlug(normalizedName) || "perspective";
    let nextId = baseId;
    let suffix = 2;
    const existingIds = new Set(perspectives.map(p => p.id));
    while (existingIds.has(nextId)) {
      nextId = `${baseId}-${suffix}`;
      suffix += 1;
    }

    const nextPerspective: BoardPerspective = {
      id: nextId,
      label: normalizedName.toUpperCase(),
      caption: "",
      statuses: baseStatuses,
      statusSource: { kind: "workflow_state" },
      visibleBoardColumnIds: columns.map(col => col.id)
    };

    await persistPerspectives([...perspectives, nextPerspective]);
    setNewPerspectiveName("");
  };

  const handleDeletePerspective = async (perspectiveId: string) => {
    if (perspectives.length <= 1) {
      return;
    }

    const nextPerspectives = perspectives.filter(p => p.id !== perspectiveId);
    const currentDefault = snapshot?.preferences.defaultBoardMode;
    const fallbackDefault = nextPerspectives[0]?.id ?? "dev";
    const nextDefault = currentDefault === perspectiveId ? fallbackDefault : undefined;

    await persistPerspectives(nextPerspectives, nextDefault);
  };

  const handleToggleColumn = async (perspectiveId: string, columnId: string, visible: boolean) => {
    const nextPerspectives = perspectives.map((perspective) => {
      if (perspective.id !== perspectiveId) {
        return perspective;
      }

      const currentVisible =
        Array.isArray(perspective.visibleBoardColumnIds) && perspective.visibleBoardColumnIds.length > 0
          ? new Set(perspective.visibleBoardColumnIds)
          : new Set(columns.map(col => col.id));

      if (visible) {
        currentVisible.add(columnId);
      } else {
        currentVisible.delete(columnId);
      }

      return {
        ...perspective,
        visibleBoardColumnIds: Array.from(currentVisible)
      };
    });

    await persistPerspectives(nextPerspectives);
  };

  return (
    <div className="perspectives-settings">
      <Section
        title="Perspectivas"
        subtitle="Crie perspectivas do board e escolha quais colunas ficam visiveis em cada uma."
        className="perspectives-settings__card"
      >
        <div className="perspectives-settings__create-row">
          <FormField label="Nova perspectiva">
            <TextInput
              value={newPerspectiveName}
              placeholder="Ex: Operacoes"
              onChange={event => setNewPerspectiveName(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter") {
                  void handleCreatePerspective();
                }
              }}
            />
          </FormField>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleCreatePerspective()}
            disabled={saving || !newPerspectiveName.trim()}
          >
            {saving ? "Salvando..." : "Criar perspectiva"}
          </Button>
        </div>
      </Section>

      <div className="perspectives-settings__grid">
        {perspectives.map((perspective) => {
          const visibleSet =
            Array.isArray(perspective.visibleBoardColumnIds) && perspective.visibleBoardColumnIds.length > 0
              ? new Set(perspective.visibleBoardColumnIds)
              : new Set(columns.map(col => col.id));

          return (
            <Section
              key={perspective.id}
              title={perspective.label}
              subtitle={perspective.caption || `ID: ${perspective.id}`}
              className="perspectives-settings__card"
              actions={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleDeletePerspective(perspective.id)}
                  disabled={saving || perspectives.length <= 1}
                >
                  Remover
                </Button>
              }
            >
              <div className="perspectives-settings__column-list">
                {loadingColumns && <p className="perspectives-settings__empty">Carregando colunas...</p>}

                {!loadingColumns && columns.length === 0 && (
                  <p className="perspectives-settings__empty">Nenhuma coluna ativa encontrada.</p>
                )}

                {!loadingColumns &&
                  columns.map((column) => (
                    <label key={`${perspective.id}-${column.id}`} className="perspectives-settings__checkbox-row">
                      <input
                        type="checkbox"
                        checked={visibleSet.has(column.id)}
                        onChange={(event) => void handleToggleColumn(perspective.id, column.id, event.target.checked)}
                      />
                      <span>{column.name}</span>
                    </label>
                  ))}
              </div>
            </Section>
          );
        })}
      </div>
    </div>
  );
}
