import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  buildTaskInputFromFieldDrafts,
  buildTaskTypeMetaMap,
  createTaskFieldDrafts,
  getTaskTypeDisplayMeta,
  isTaskFieldValueEmpty,
  matchesTaskFieldStorage,
  resolveWorkItemFieldBindingsForContext
} from "@/entities/task";
import type {
  BoardConfig,
  Task,
  TaskCustomFieldValue,
  TaskFieldDefinition,
  TaskPriority,
  TaskStatus,
  TaskStatusId
} from "@/entities/task";
import type { Member, MembersById } from "@/entities/member";
import type {
  AiAgentSummary,
  CreateTaskInput,
  DocumentKind,
  TaskScheduleInput,
  UpdateTaskInput,
  WorkItemLinkedDocument,
  WorkspaceDocument
} from "@/modules/workspace/model";
import {
  FieldShell,
  WorkItemFieldRenderer,
  normalizeTaskFieldPresentationValue,
  resolveFieldShellStyle,
  validateTaskFieldPresentationValue
} from "@/entities/task/ui/field-presentation";
import { cn } from "@/shared/lib/cn";
import { Button, ModalShell } from "@/shared/ui";
import "./task-details-modal.css";

type DetailZone = "main" | "side";

type TaskDetailsModalProps =
  | {
      mode: "create";
      statuses: TaskStatus[];
      initialStatusId: TaskStatusId;
      initialTypeId: string;
      membersById: MembersById;
      boardConfig: BoardConfig;
      onCreateTask: (input: CreateTaskInput) => Promise<void> | void;
      onClose: () => void;
      availableTags?: Array<{ id: string; name: string; color: string }>;
    }
  | {
      mode: "edit";
      task: Task;
      status: TaskStatus;
      statuses: TaskStatus[];
      assignee: Member;
      membersById: MembersById;
      availableTags?: Array<{ id: string; name: string; color: string }>;
      creatorName?: string;
      boardConfig: BoardConfig;
      onSaveTask: (taskId: string, input: UpdateTaskInput) => Promise<void> | void;
      onUpdatePriority: (taskId: string, priority: TaskPriority) => Promise<void> | void;
      onUpdateStatus: (taskId: string, statusId: TaskStatusId) => Promise<void> | void;
      onUpdateTitle: (taskId: string, title: string) => Promise<void> | void;
      onUpdateDescription: (taskId: string, description: string) => Promise<void> | void;
      onUpdateCustomField: (taskId: string, fieldId: string, value: TaskCustomFieldValue) => Promise<void> | void;
      onUpdateSchedule: (taskId: string, input: TaskScheduleInput) => Promise<void> | void;
      aiAgents: AiAgentSummary[];
      onRunAiAgentOnItem: (
        itemId: string,
        agentId: string,
        input: { instruction: string; includeSemanticContext?: boolean; topKContextDocs?: number }
      ) => Promise<{ runId: string; content: string }>;
      onRunAiRiskAnalysis: (
        itemId: string,
        input?: { includeSemanticContext?: boolean; topKContextDocs?: number }
      ) => Promise<{ runId: string; content: string }>;
      listWorkspaceDocuments: () => Promise<WorkspaceDocument[]>;
      createWorkspaceDocument?: (input: {
        title: string;
        content?: string;
        kind?: DocumentKind;
        linkedEntityType?: "work_item" | "customer" | "proposal" | "contract";
        linkedEntityId?: string;
        tags?: string[];
        metadata?: WorkspaceDocument["metadata"];
        position?: number;
      }) => Promise<WorkspaceDocument>;
      listWorkItemLinkedDocuments: (itemId: string) => Promise<WorkItemLinkedDocument[]>;
      linkDocumentToWorkItem: (itemId: string, documentId: string) => Promise<WorkItemLinkedDocument[]>;
      unlinkDocumentFromWorkItem: (itemId: string, documentId: string) => Promise<void>;
      onOpenDocument?: (documentId: string) => void;
      onClose: () => void;
    };

function toJsonComparable(value: unknown) {
  return JSON.stringify(value ?? null);
}

function isReadonlyField(field: TaskFieldDefinition) {
  return (
    field.isEditable === false ||
    field.config?.readOnlyAfterCreate === true ||
    matchesTaskFieldStorage(field, { kind: "item_property", property: "createdBy" })
  );
}

const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  wiki: "Wiki",
  proposal: "Proposta",
  contract: "Contrato"
};

const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  viewed: "Visualizado",
  approved: "Aprovado",
  rejected: "Recusado",
  expired: "Expirado",
  accepted: "Aceito",
  signed: "Assinado",
  cancelled: "Cancelado"
};

function formatDocumentDate(value: string | Date | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function resolveFieldLayoutClass(field: TaskFieldDefinition, zone: DetailZone) {
  const shouldSpan =
    zone === "main" &&
    (field.type === "long_text" ||
      field.type === "checklist" ||
      field.type === "schedule" ||
      matchesTaskFieldStorage(field, { kind: "item_property", property: "title" }) ||
      matchesTaskFieldStorage(field, { kind: "item_property", property: "description" }));

  return shouldSpan ? "task-details__field-frame--wide" : "task-details__field-frame--compact";
}

export function TaskDetailsModal(props: TaskDetailsModalProps) {
  const isCreateMode = props.mode === "create";
  const task = props.mode === "edit" ? props.task : null;
  const statuses = props.statuses;
  const boardConfig = props.boardConfig;
  const availableTags = props.availableTags ?? [];
  const listWorkspaceDocuments = props.mode === "edit" ? props.listWorkspaceDocuments : null;
  const listWorkItemLinkedDocuments = props.mode === "edit" ? props.listWorkItemLinkedDocuments : null;
  const unlinkDocumentFromWorkItem = props.mode === "edit" ? props.unlinkDocumentFromWorkItem : null;
  const openDocument = props.mode === "edit" ? props.onOpenDocument : undefined;

  const typeMap = useMemo(() => buildTaskTypeMetaMap(boardConfig.taskTypes), [boardConfig.taskTypes]);
  const initialTypeId = task?.type ?? (props.mode === "create" ? props.initialTypeId : boardConfig.taskTypes[0]?.id ?? "task");
  const [selectedTypeId, setSelectedTypeId] = useState(initialTypeId);
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, TaskCustomFieldValue>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [workspaceDocuments, setWorkspaceDocuments] = useState<WorkspaceDocument[]>([]);
  const [linkedDocuments, setLinkedDocuments] = useState<WorkItemLinkedDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState("");

  const detailBindings = useMemo(
    () =>
      resolveWorkItemFieldBindingsForContext(
        boardConfig,
        selectedTypeId,
        isCreateMode ? "form" : "detail"
      ),
    [boardConfig, isCreateMode, selectedTypeId]
  );

  const orderedVisibleFields = useMemo(
    () =>
      detailBindings
        .map(binding => binding.field)
        .filter(field => {
          if (field.config?.formVisible === false) {
            return false;
          }

          if (!isCreateMode) {
            return true;
          }

          return !(field.type === "work_item_type" || matchesTaskFieldStorage(field, { kind: "item_property", property: "typeSlug" }));
        }),
    [detailBindings, isCreateMode]
  );

  const initialFieldDrafts = useMemo(
    () => createTaskFieldDrafts(task, orderedVisibleFields),
    [orderedVisibleFields, task]
  );

  useEffect(() => {
    setSelectedTypeId(initialTypeId);
  }, [initialTypeId]);

  useEffect(() => {
    setFieldDrafts(current => {
      const seeded = createTaskFieldDrafts(task, orderedVisibleFields);
      if (isCreateMode) {
        for (const field of orderedVisibleFields) {
          if (field.id in current) {
            seeded[field.id] = current[field.id];
          }
        }
      }
      return seeded;
    });
  }, [isCreateMode, orderedVisibleFields, task]);

  useEffect(() => {
    setError("");
  }, [selectedTypeId, task?.id]);

  useEffect(() => {
    if (!task || !listWorkspaceDocuments || !listWorkItemLinkedDocuments) {
      setWorkspaceDocuments([]);
      setLinkedDocuments([]);
      return;
    }

    let cancelled = false;
    setDocumentsLoading(true);
    setDocumentsError("");

    void Promise.all([
      listWorkspaceDocuments(),
      listWorkItemLinkedDocuments(task.id)
    ])
      .then(([nextWorkspaceDocuments, nextLinkedDocuments]) => {
        if (cancelled) {
          return;
        }

        setWorkspaceDocuments(nextWorkspaceDocuments);
        setLinkedDocuments(nextLinkedDocuments);
      })
      .catch(() => {
        if (!cancelled) {
          setDocumentsError("Nao foi possivel carregar documentos vinculados.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDocumentsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [listWorkspaceDocuments, listWorkItemLinkedDocuments, task]);

  const mainColumnFields = useMemo(
    () =>
      detailBindings
        .filter(binding => binding.zone === "main")
        .map(binding => binding.field)
        .filter(field => orderedVisibleFields.some(visibleField => visibleField.id === field.id)),
    [detailBindings, orderedVisibleFields]
  );

  const sideColumnFields = useMemo(
    () =>
      detailBindings
        .filter(binding => binding.zone === "side")
        .map(binding => binding.field)
        .filter(field => orderedVisibleFields.some(visibleField => visibleField.id === field.id)),
    [detailBindings, orderedVisibleFields]
  );

  const workspaceDocumentsById = useMemo(
    () => new Map(workspaceDocuments.map((document) => [document.id, document])),
    [workspaceDocuments]
  );

  const documentRows = useMemo(() => {
    const source = linkedDocuments.length > 0 ? linkedDocuments : task?.linkedDocuments ?? [];
    return source.map((link) => {
      const document = workspaceDocumentsById.get(link.id);
      return {
        ...link,
        kind: link.kind ?? document?.kind,
        status: link.status ?? (typeof document?.metadata.status === "string" ? document.metadata.status : undefined),
        createdAt: link.createdAt ?? document?.createdAt,
        updatedAt: link.updatedAt ?? document?.updatedAt
      };
    });
  }, [linkedDocuments, task?.linkedDocuments, workspaceDocumentsById]);

  const activeTypeMeta = getTaskTypeDisplayMeta(typeMap, selectedTypeId);
  const accentVars = {
    "--task-accent-background": activeTypeMeta.background,
    "--task-accent-border": activeTypeMeta.border,
    "--task-accent-text": activeTypeMeta.text
  } as CSSProperties;

  const normalizedCurrentDrafts = useMemo(
    () =>
      orderedVisibleFields.reduce<Record<string, TaskCustomFieldValue>>((acc, field) => {
        acc[field.id] = normalizeTaskFieldPresentationValue(field, fieldDrafts[field.id] ?? null);
        return acc;
      }, {}),
    [fieldDrafts, orderedVisibleFields]
  );

  const hasChanges = useMemo(() => {
    if (isCreateMode || !task) {
      return false;
    }

    return orderedVisibleFields.some(
      field => toJsonComparable(normalizedCurrentDrafts[field.id]) !== toJsonComparable(initialFieldDrafts[field.id])
    );
  }, [initialFieldDrafts, isCreateMode, normalizedCurrentDrafts, orderedVisibleFields, task]);

  const fieldErrorsById = useMemo(
    () =>
      orderedVisibleFields.reduce<Record<string, string>>((acc, field) => {
        const value = normalizedCurrentDrafts[field.id];

        if (field.required === true && isTaskFieldValueEmpty(field, value)) {
          acc[field.id] = `Preencha o campo "${field.label}".`;
          return acc;
        }

        const validationError = validateTaskFieldPresentationValue({
          field,
          value,
          boardConfig,
          statuses,
          membersById: props.membersById,
          availableTags,
          task
        });

        if (validationError) {
          acc[field.id] = validationError;
        }

        return acc;
      }, {}),
    [availableTags, boardConfig, normalizedCurrentDrafts, orderedVisibleFields, props.membersById, statuses, task]
  );

  const firstFieldError = useMemo(() => {
    const fieldWithError = orderedVisibleFields.find(field => typeof fieldErrorsById[field.id] === "string");
    return fieldWithError ? fieldErrorsById[fieldWithError.id] ?? "" : "";
  }, [fieldErrorsById, orderedVisibleFields]);

  const canSave = isCreateMode ? !saving && !firstFieldError : !saving && hasChanges && !firstFieldError;

  const updateFieldDraft = (field: TaskFieldDefinition, value: TaskCustomFieldValue) => {
    setFieldDrafts(current => ({
      ...current,
      [field.id]: value
    }));

    if (field.type === "work_item_type" && typeof value === "string" && value.trim().length > 0) {
      setSelectedTypeId(value);
    }
  };

  const renderFieldPanel = (field: TaskFieldDefinition, zone: DetailZone) => {
    const readOnly = isReadonlyField(field) && !isCreateMode;
    const fieldError = fieldErrorsById[field.id] ?? null;
    const mode = readOnly ? "display" : "edit";
    const context = isCreateMode ? "form" : "detail";
    const shellStyle = resolveFieldShellStyle({
      field,
      mode,
      context,
      readonly: readOnly
    });

    return (
      <section
        key={field.id}
        className={cn(
          zone === "main" ? "task-details__section" : "task-details__panel",
          "task-details__field-frame",
          `task-details__field-frame--${shellStyle.kind}`,
          resolveFieldLayoutClass(field, zone),
          readOnly && "task-details__field-frame--readonly"
        )}
        data-field-type={field.type}
      >
        <FieldShell
          label={field.label}
          hint={field.description}
          required={field.required}
          error={fieldError}
          readonly={readOnly}
          kind={shellStyle.kind}
          helpMode={shellStyle.helpMode}
        >
          <WorkItemFieldRenderer
            field={field}
            value={normalizedCurrentDrafts[field.id]}
            mode={mode}
            context={context}
            boardConfig={boardConfig}
            statuses={statuses}
            membersById={props.membersById}
            availableTags={availableTags}
            task={task}
            readonly={readOnly}
            disabled={saving}
            autoFocus={isCreateMode && orderedVisibleFields[0]?.id === field.id}
            onChange={value => updateFieldDraft(field, value)}
            error={fieldError}
          />
        </FieldShell>
      </section>
    );
  };

  const handleUnlinkDocument = async (documentId: string) => {
    if (!task || !unlinkDocumentFromWorkItem) {
      return;
    }

    setDocumentsLoading(true);
    setDocumentsError("");

    try {
      await unlinkDocumentFromWorkItem(task.id, documentId);
      setLinkedDocuments((current) => current.filter((document) => document.id !== documentId));
    } catch {
      setDocumentsError("Nao foi possivel remover o vinculo do documento.");
    } finally {
      setDocumentsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (firstFieldError) {
      setError(firstFieldError);
      return;
    }

    const draftPayload = buildTaskInputFromFieldDrafts(orderedVisibleFields, normalizedCurrentDrafts);
    const nextTitle = typeof draftPayload.title === "string" ? draftPayload.title.trim() : "";
    if (nextTitle.length < 2) {
      setError("O titulo precisa ter ao menos 2 caracteres.");
      return;
    }

    setError("");
    setSaving(true);

    try {
      if (isCreateMode) {
        const payload: CreateTaskInput = {
          type: typeof draftPayload.type === "string" && draftPayload.type.length > 0 ? draftPayload.type : selectedTypeId,
          title: nextTitle,
          description: typeof draftPayload.description === "string" ? draftPayload.description : "",
          priority: typeof draftPayload.priority === "number" ? (draftPayload.priority as TaskPriority) : 2,
          statusId: typeof draftPayload.statusId === "string" ? draftPayload.statusId : props.initialStatusId,
          assigneeId: draftPayload.assigneeId,
          dueDate: draftPayload.dueDate,
          tags: draftPayload.tags,
          checklist: draftPayload.checklist,
          fields: draftPayload.fields,
          customFieldValues: draftPayload.customFieldValues
        };

        await Promise.resolve(props.onCreateTask(payload));
        props.onClose();
        return;
      }

      if (!task) {
        return;
      }

      const currentPayload = buildTaskInputFromFieldDrafts(orderedVisibleFields, initialFieldDrafts);
      const nextPayload: UpdateTaskInput = {};

      if (nextTitle !== task.title) {
        nextPayload.title = nextTitle;
      }

      if (typeof draftPayload.description === "string" && draftPayload.description !== currentPayload.description) {
        nextPayload.description = draftPayload.description;
      }

      if (typeof draftPayload.typeSlug === "string" && draftPayload.typeSlug !== currentPayload.typeSlug) {
        nextPayload.typeSlug = draftPayload.typeSlug;
      }

      if (draftPayload.stateId !== currentPayload.stateId && typeof draftPayload.stateId === "string") {
        nextPayload.stateId = draftPayload.stateId;
      }

      if (draftPayload.assigneeId !== currentPayload.assigneeId) {
        nextPayload.assigneeId = (draftPayload.assigneeId as string | null | undefined) ?? null;
      }

      if (draftPayload.dueDate !== currentPayload.dueDate) {
        nextPayload.dueDate = (draftPayload.dueDate as string | null | undefined) ?? null;
      }

      if (toJsonComparable(draftPayload.tags) !== toJsonComparable(currentPayload.tags)) {
        nextPayload.tags = Array.isArray(draftPayload.tags) ? draftPayload.tags : [];
      }

      if (draftPayload.priority !== currentPayload.priority && typeof draftPayload.priority === "number") {
        nextPayload.priority = draftPayload.priority as TaskPriority;
      }

      if (toJsonComparable(draftPayload.checklist) !== toJsonComparable(currentPayload.checklist)) {
        nextPayload.checklist = draftPayload.checklist;
      }

      if (toJsonComparable(draftPayload.fields) !== toJsonComparable(currentPayload.fields)) {
        nextPayload.fields = (draftPayload.fields as Record<string, unknown> | undefined) ?? {};
      }

      if (toJsonComparable(draftPayload.customFieldValues) !== toJsonComparable(currentPayload.customFieldValues)) {
        nextPayload.customFieldValues = (draftPayload.customFieldValues as Record<string, unknown> | undefined) ?? {};
      }

      if (Object.keys(nextPayload).length === 0) {
        return;
      }

      await Promise.resolve(props.onSaveTask(task.id, nextPayload));
    } catch {
      setError(isCreateMode ? "Nao foi possivel criar o item." : "Nao foi possivel salvar as alteracoes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell titleId="task-details-title" className="task-details" onClose={props.onClose}>
      <div className="task-details__surface" style={accentVars}>
        <header className="task-details__topbar">
          <div className="task-details__header-copy">
            <p className="task-details__breadcrumbs">{isCreateMode ? "Novo item" : "Work item"}</p>
            <h2 id="task-details-title">{isCreateMode ? "Criar work item" : "Editar work item"}</h2>
          </div>
          <button className="task-details__close" type="button" onClick={props.onClose} aria-label="Fechar editor">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" width="16" height="16">
              <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className={`task-details__body ${isCreateMode ? "task-details__body--create" : "task-details__body--edit"}`}>
          <section className="task-details__main">
            {mainColumnFields.length > 0 ? (
              mainColumnFields.map(field => renderFieldPanel(field, "main"))
            ) : (
              <section className="task-details__section">
                <div className="task-details__section-head">
                  <h3 className="task-details__summary-style-title">Sem campos principais</h3>
                </div>
                <p className="task-details__muted">Associe campos a este tipo de item para montar o formulario.</p>
              </section>
            )}
          </section>

          <aside className="task-details__side">
            {sideColumnFields.map(field => renderFieldPanel(field, "side"))}
            {!isCreateMode ? (
              <section className="task-details__panel task-details__documents">
                <h3 className="task-details__summary-style-title">Documentos</h3>
                {documentsError ? <p className="task-details__documents-error">{documentsError}</p> : null}
                {documentsLoading && documentRows.length === 0 ? <p className="task-details__muted">Carregando...</p> : null}
                {!documentsLoading && documentRows.length === 0 ? <p className="task-details__muted">Nenhum documento.</p> : null}
                {documentRows.length > 0 ? (
                  <div className="task-details__documents-list">
                    {documentRows.map((document) => {
                      const kindLabel = document.kind ? DOCUMENT_KIND_LABELS[document.kind] : "Documento";
                      const statusLabel =
                        typeof document.status === "string" && document.status.trim()
                          ? DOCUMENT_STATUS_LABELS[document.status] ?? document.status
                          : "-";

                      return (
                        <article
                          className="task-details__document-row"
                          key={document.id}
                          role={openDocument ? "button" : undefined}
                          tabIndex={openDocument ? 0 : undefined}
                          onClick={openDocument ? () => openDocument(document.id) : undefined}
                          onKeyDown={openDocument ? (e) => { if (e.key === "Enter" || e.key === " ") openDocument(document.id); } : undefined}
                        >
                          <div className="task-details__document-info">
                            <span className="task-details__document-kind">{kindLabel}</span>
                            <strong className="task-details__document-title">{document.title}</strong>
                            {document.status && document.status !== "draft" ? (
                              <span className="task-details__document-status" data-status={document.status}>{statusLabel}</span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="task-details__document-remove"
                            onClick={(e) => { e.stopPropagation(); void handleUnlinkDocument(document.id); }}
                            disabled={documentsLoading}
                            aria-label="Remover documento"
                          >
                            <svg viewBox="0 0 16 16" fill="none" width="14" height="14" aria-hidden="true">
                              <path d="M2 4h12M5 4V2.5A.5.5 0 0 1 5.5 2h5a.5.5 0 0 1 .5.5V4M6 7v5M10 7v5M3 4l1 9.5A.5.5 0 0 0 4.5 14h7a.5.5 0 0 0 .5-.5L13 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </article>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            ) : null}
          </aside>
        </div>

        <footer className="task-details__actionbar">
          <div className="task-details__actionbar-copy">
            {error ? (
              <p className="task-details__error">{error}</p>
            ) : (
              <p>
                {isCreateMode
                  ? "Os campos exibidos aqui seguem o schema configurado para este tipo de work item."
                  : "A edicao usa o mesmo registry de tipos do card e das configuracoes do workspace."}
              </p>
            )}
          </div>
          <div className="task-details__actionbar-actions">
            <Button type="button" size="sm" variant="outline" onClick={props.onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={() => void handleSubmit()}
              disabled={!canSave}
            >
              {saving ? (isCreateMode ? "Criando..." : "Salvando...") : isCreateMode ? "Criar item" : "Salvar alteracoes"}
            </Button>
          </div>
        </footer>
      </div>
    </ModalShell>
  );
}
