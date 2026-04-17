import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { MemberAvatar } from "@/entities/member";
import {
  buildTaskChecklistSummary,
  buildTaskTypeMetaMap,
  getTaskTypeDisplayMeta,
  isSystemCardFieldId,
  priorityMeta,
  resolveFieldIdsForTaskType,
  taskPriorityOptions
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
  TaskScheduleInput,
  UpdateTaskInput,
  WorkItemLinkedDocument,
  WorkspaceDocument
} from "@/modules/workspace/model";
import { Button, FormField, ModalShell, Select, TextInput, Textarea } from "@/shared/ui";
import { TaskTypeIcon, resolveTaskTypeIconName } from "@/entities/task/ui/task-type-icon";
import "./task-details-modal.css";

type TaskDetailsModalProps =
  | {
      mode: "create";
      statuses: TaskStatus[];
      initialStatusId: TaskStatusId;
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
      onToggleChecklistItem: (taskId: string, itemId: string) => Promise<void> | void;
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
      listWorkItemLinkedDocuments: (itemId: string) => Promise<WorkItemLinkedDocument[]>;
      linkDocumentToWorkItem: (itemId: string, documentId: string) => Promise<WorkItemLinkedDocument[]>;
      unlinkDocumentFromWorkItem: (itemId: string, documentId: string) => Promise<void>;
      onClose: () => void;
    };

interface ScheduleDraft {
  plannedStartAt: string;
  plannedEndAt: string;
}

type CardAiMessageRole = "user" | "assistant" | "system";

interface CardAiMessage {
  id: string;
  role: CardAiMessageRole;
  content: string;
  createdAt: string;
}

function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeDateTimeInput(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (entry: number) => entry.toString().padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function parseDateTime(value: string | null | undefined): number | null {
  if (!value || value.trim().length === 0) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function normalizeDateInput(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function getFieldOptions(definition: TaskFieldDefinition): string[] {
  if (!Array.isArray(definition.options)) return [];
  return definition.options.map(option => String(option).trim()).filter(Boolean);
}

function normalizeFieldValue(definition: TaskFieldDefinition, value: TaskCustomFieldValue): TaskCustomFieldValue {
  if (definition.type === "number") {
    const asString = String(value ?? "").trim();
    if (!asString) return null;
    const parsed = Number(asString);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (definition.type === "boolean") return value === true;

  if (definition.type === "select") {
    const asString = String(value ?? "").trim();
    return asString.length > 0 ? asString : null;
  }

  if (definition.type === "multi_select" || definition.type === "multi-select") {
    if (Array.isArray(value)) return value.map(entry => entry.trim()).filter(Boolean);
    return String(value ?? "")
      .split(",")
      .map(entry => entry.trim())
      .filter(Boolean);
  }

  return value ?? "";
}

export function TaskDetailsModal(props: TaskDetailsModalProps) {
  const isCreateMode = props.mode === "create";
  const task = props.mode === "edit" ? props.task : null;
  const statuses = props.statuses;
  const boardConfig = props.boardConfig;
  const availableTags = props.availableTags ?? [];

  const typeMap = useMemo(() => buildTaskTypeMetaMap(boardConfig.taskTypes), [boardConfig.taskTypes]);
  const fieldMap = useMemo(
    () =>
      boardConfig.fieldDefinitions.reduce<Record<string, TaskFieldDefinition>>((acc, field) => {
        acc[field.id] = field;
        return acc;
      }, {}),
    [boardConfig.fieldDefinitions]
  );

  const initialType = boardConfig.taskTypes[0]?.id ?? "task";
  const initialStatusId = isCreateMode ? props.initialStatusId : props.status.id;
  const createStatusId = props.mode === "create" ? props.initialStatusId : "";
  const initialAssigneeId = isCreateMode ? Object.values(props.membersById)[0]?.id ?? "" : props.task.assignee;

  const [titleDraft, setTitleDraft] = useState(isCreateMode ? "" : props.task.title);
  const [descriptionDraft, setDescriptionDraft] = useState(isCreateMode ? "" : props.task.text);
  const [typeDraft, setTypeDraft] = useState(isCreateMode ? initialType : props.task.type);
  const [assigneeDraft, setAssigneeDraft] = useState(initialAssigneeId);
  const [dueDateDraft, setDueDateDraft] = useState(isCreateMode ? "" : normalizeDateInput(props.task.due));
  const [tagsDraft, setTagsDraft] = useState<string[]>(isCreateMode ? [] : props.task.tags);
  const [createdByDraft, setCreatedByDraft] = useState(
    isCreateMode
      ? ""
      : typeof props.task.customFields["createdBy"] === "string"
        ? String(props.task.customFields["createdBy"])
        : props.creatorName ?? props.assignee.name
  );
  const [statusDraft, setStatusDraft] = useState(initialStatusId);
  const [priorityDraft, setPriorityDraft] = useState<TaskPriority>(isCreateMode ? 2 : props.task.priority);
  const [customFieldDrafts, setCustomFieldDrafts] = useState<Record<string, TaskCustomFieldValue>>({});
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft>({
    plannedStartAt: isCreateMode ? "" : normalizeDateTimeInput(props.task.plannedStartAt),
    plannedEndAt: isCreateMode ? "" : normalizeDateTimeInput(props.task.plannedEndAt)
  });
  const [isMetadataCollapsed, setIsMetadataCollapsed] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [availableDocuments, setAvailableDocuments] = useState<WorkspaceDocument[]>([]);
  const [linkedDocuments, setLinkedDocuments] = useState<WorkItemLinkedDocument[]>([]);
  const [documentToLinkId, setDocumentToLinkId] = useState("");
  const [isDocsLoading, setIsDocsLoading] = useState(false);
  const [isLinkingDocument, setIsLinkingDocument] = useState(false);
  const [unlinkingDocumentId, setUnlinkingDocumentId] = useState<string | null>(null);
  const [docsError, setDocsError] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiMessages, setAiMessages] = useState<CardAiMessage[]>([]);
  const [isAiRunning, setIsAiRunning] = useState(false);
  const [aiError, setAiError] = useState("");

  const memberOptions = useMemo(
    () => Object.values(props.membersById).sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
    [props.membersById]
  );

  const selectedAssignee =
    props.membersById[assigneeDraft] ??
    (props.mode === "edit" ? props.assignee : memberOptions[0]);
  const listWorkspaceDocuments =
    props.mode === "edit" ? props.listWorkspaceDocuments : null;
  const listWorkItemLinkedDocuments =
    props.mode === "edit" ? props.listWorkItemLinkedDocuments : null;
  const editModeAiAgents = props.mode === "edit" ? props.aiAgents : [];

  const linkableDocuments = useMemo(() => {
    if (isCreateMode) {
      return [];
    }

    const linkedIds = new Set(linkedDocuments.map((document) => document.id));
    return availableDocuments.filter((document) => !linkedIds.has(document.id));
  }, [availableDocuments, isCreateMode, linkedDocuments]);

  const visibleCardFieldIds = useMemo(
    () =>
      resolveFieldIdsForTaskType(
        typeDraft,
        boardConfig.cardLayout.visibleFieldIdsByType,
        boardConfig.cardLayout.visibleFieldIds
      ),
    [boardConfig.cardLayout, typeDraft]
  );

  const visibleDetailFieldIds = useMemo(
    () => resolveFieldIdsForTaskType(typeDraft, boardConfig.cardLayout.detailVisibleFieldIdsByType, visibleCardFieldIds),
    [boardConfig.cardLayout.detailVisibleFieldIdsByType, typeDraft, visibleCardFieldIds]
  );

  const visibleFieldIdSet = useMemo(() => {
    if (isCreateMode) {
      return new Set([
        "sys:title",
        "sys:description",
        "sys:type",
        "sys:status",
        "sys:priority",
        "sys:assignee",
        "sys:due-date",
        "sys:tags",
        "sys:schedule"
      ]);
    }

    return new Set(visibleDetailFieldIds);
  }, [isCreateMode, visibleDetailFieldIds]);

  const visibleCustomFields = useMemo(
    () =>
      visibleDetailFieldIds
        .filter(fieldId => !isSystemCardFieldId(fieldId))
        .map(fieldId => fieldMap[fieldId])
        .filter((field): field is TaskFieldDefinition => Boolean(field)),
    [fieldMap, visibleDetailFieldIds]
  );

  useEffect(() => {
    if (!isCreateMode) {
      return;
    }

    setTitleDraft("");
    setDescriptionDraft("");
    setTypeDraft(initialType);
    setAssigneeDraft(initialAssigneeId);
    setDueDateDraft("");
    setTagsDraft([]);
    setCreatedByDraft("");
    setStatusDraft(createStatusId);
    setPriorityDraft(2);
    setScheduleDraft({ plannedStartAt: "", plannedEndAt: "" });
    setIsMetadataCollapsed(false);
    setCustomFieldDrafts({});
    setError("");
  }, [createStatusId, isCreateMode, initialAssigneeId, initialType]);

  useEffect(() => {
    if (isCreateMode) {
      return;
    }

    setTitleDraft(props.task.title);
    setDescriptionDraft(props.task.text);
    setTypeDraft(props.task.type);
    setAssigneeDraft(props.task.assignee);
    setDueDateDraft(normalizeDateInput(props.task.due));
    setTagsDraft(props.task.tags);
    setCreatedByDraft(
      typeof props.task.customFields["createdBy"] === "string"
        ? String(props.task.customFields["createdBy"])
        : props.creatorName ?? props.assignee.name
    );
    setStatusDraft(props.status.id);
    setPriorityDraft(props.task.priority);
    setScheduleDraft({
      plannedStartAt: normalizeDateTimeInput(props.task.plannedStartAt),
      plannedEndAt: normalizeDateTimeInput(props.task.plannedEndAt)
    });
    setIsMetadataCollapsed(false);
    setError("");
    setCustomFieldDrafts(
      Object.keys(props.task.customFields).reduce<Record<string, TaskCustomFieldValue>>((acc, fieldId) => {
        acc[fieldId] = props.task.customFields[fieldId] ?? null;
        return acc;
      }, {})
    );
  }, [
    isCreateMode,
    props.mode,
    props.mode === "edit" ? props.task.id : null,
    props.mode === "edit" ? props.status.id : null
  ]);

  useEffect(() => {
    setCustomFieldDrafts(current => {
      const next = { ...current };

      for (const field of visibleCustomFields) {
        if (!(field.id in next)) {
          next[field.id] = task?.customFields[field.id] ?? null;
        }
      }

      return next;
    });
  }, [task, visibleCustomFields]);

  useEffect(() => {
    if (props.mode !== "edit" || !task) {
      setAvailableDocuments([]);
      setLinkedDocuments([]);
      setDocumentToLinkId("");
      setDocsError("");
      return;
    }

    let mounted = true;
    setIsDocsLoading(true);
    setDocsError("");
    setLinkedDocuments(task.linkedDocuments ?? []);

    if (!listWorkspaceDocuments || !listWorkItemLinkedDocuments) {
      setIsDocsLoading(false);
      return;
    }

    Promise.all([listWorkspaceDocuments(), listWorkItemLinkedDocuments(task.id)])
      .then(([workspaceDocuments, linked]) => {
        if (!mounted) {
          return;
        }
        setAvailableDocuments(workspaceDocuments);
        setLinkedDocuments(linked);
      })
      .catch((loadError) => {
        if (!mounted) {
          return;
        }
        setDocsError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar docs vinculadas.");
      })
      .finally(() => {
        if (mounted) {
          setIsDocsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [
    props.mode,
    listWorkspaceDocuments,
    listWorkItemLinkedDocuments,
    task?.id
  ]);

  useEffect(() => {
    if (props.mode !== "edit") {
      return;
    }
    setSelectedAgentId(editModeAiAgents[0]?.id ?? "");
    setAiPrompt("");
    setAiMessages([]);
    setAiError("");
  }, [props.mode, editModeAiAgents, task?.id]);

  const checklist = task ? buildTaskChecklistSummary(task) : { done: 0, total: 0, percent: 0 };
  const activeTypeMeta = getTaskTypeDisplayMeta(typeMap, typeDraft);
  const activeStatusLabel = statuses.find(option => option.id === statusDraft)?.label ?? statusDraft;
  const priority = priorityMeta[priorityDraft] ?? priorityMeta[2];
  const canSave = isCreateMode ? titleDraft.trim().length >= 2 && !saving : !saving;
  const accentVars = {
    "--task-accent-background": activeTypeMeta.background,
    "--task-accent-border": activeTypeMeta.border,
    "--task-accent-text": activeTypeMeta.text
  } as CSSProperties;

  const hasChanges =
    !isCreateMode &&
    task &&
    ((visibleFieldIdSet.has("sys:title") && titleDraft.trim() !== task.title) ||
      descriptionDraft !== task.text ||
      typeDraft !== task.type ||
      assigneeDraft !== task.assignee ||
      dueDateDraft !== normalizeDateInput(task.due) ||
      JSON.stringify(tagsDraft) !== JSON.stringify(task.tags) ||
      createdByDraft.trim() !==
        (
          typeof task.customFields["createdBy"] === "string"
            ? String(task.customFields["createdBy"]).trim()
            : (props.creatorName ?? props.assignee.name).trim()
        ) ||
      statusDraft !== props.status.id ||
      priorityDraft !== task.priority ||
      scheduleDraft.plannedStartAt !== normalizeDateTimeInput(task.plannedStartAt) ||
      scheduleDraft.plannedEndAt !== normalizeDateTimeInput(task.plannedEndAt) ||
      visibleCustomFields.some(field => {
        const current = task.customFields[field.id] ?? null;
        const draft = normalizeFieldValue(field, customFieldDrafts[field.id] ?? null);
        return JSON.stringify(current) !== JSON.stringify(draft);
      }));

  const handleLinkDocument = async () => {
    if (props.mode !== "edit" || !task || !documentToLinkId) {
      return;
    }

    setIsLinkingDocument(true);
    setDocsError("");

    try {
      const nextLinkedDocuments = await props.linkDocumentToWorkItem(task.id, documentToLinkId);
      setLinkedDocuments(nextLinkedDocuments);
      setDocumentToLinkId("");
    } catch (linkError) {
      setDocsError(linkError instanceof Error ? linkError.message : "Nao foi possivel vincular a doc.");
    } finally {
      setIsLinkingDocument(false);
    }
  };

  const handleUnlinkDocument = async (documentId: string) => {
    if (props.mode !== "edit" || !task) {
      return;
    }

    setUnlinkingDocumentId(documentId);
    setDocsError("");
    try {
      await props.unlinkDocumentFromWorkItem(task.id, documentId);
      setLinkedDocuments((current) => current.filter((document) => document.id !== documentId));
    } catch (unlinkError) {
      setDocsError(unlinkError instanceof Error ? unlinkError.message : "Nao foi possivel remover a doc vinculada.");
    } finally {
      setUnlinkingDocumentId((current) => (current === documentId ? null : current));
    }
  };

  const handleRunAiOnCard = async () => {
    if (props.mode !== "edit" || !task) {
      return;
    }

    const prompt = aiPrompt.trim();
    if (prompt.length < 2) {
      setAiError("Digite uma instrucao para a IA.");
      return;
    }

    const targetAgentId = selectedAgentId || editModeAiAgents[0]?.id;
    if (!targetAgentId) {
      setAiError("Nenhum agente de IA ativo para este workspace.");
      return;
    }

    const linkedDocsContext =
      linkedDocuments.length > 0
        ? linkedDocuments.map((document) => `- ${document.title} (${document.id})`).join("\n")
        : "- Sem docs vinculadas.";

    const enrichedInstruction = [
      prompt,
      "",
      "Considere o contexto completo deste card e das docs vinculadas abaixo na resposta:",
      linkedDocsContext
    ].join("\n");

    const userMessage: CardAiMessage = {
      id: createMessageId(),
      role: "user",
      content: prompt,
      createdAt: new Date().toISOString()
    };

    setAiMessages((current) => [...current, userMessage]);
    setAiError("");
    setIsAiRunning(true);

    try {
      const result = await props.onRunAiAgentOnItem(task.id, targetAgentId, {
        instruction: enrichedInstruction,
        includeSemanticContext: true,
        topKContextDocs: 5
      });

      setAiMessages((current) => [
        ...current,
        {
          id: result.runId || createMessageId(),
          role: "assistant",
          content: result.content,
          createdAt: new Date().toISOString()
        }
      ]);
      setAiPrompt("");
    } catch (runError) {
      setAiError(runError instanceof Error ? runError.message : "Nao foi possivel consultar a IA agora.");
      setAiMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: "system",
          content: "Falha ao executar a IA para este card.",
          createdAt: new Date().toISOString()
        }
      ]);
    } finally {
      setIsAiRunning(false);
    }
  };

  const handleSubmit = async () => {
    const trimmedTitle = titleDraft.trim();
    if (trimmedTitle.length < 2) {
      setError("O titulo precisa ter ao menos 2 caracteres.");
      return;
    }

    const start = parseDateTime(scheduleDraft.plannedStartAt);
    const end = parseDateTime(scheduleDraft.plannedEndAt);
    if (start !== null && end !== null && end <= start) {
      setError("A data final precisa ser maior que a inicial.");
      return;
    }

    setError("");
    setSaving(true);

    try {
      if (isCreateMode) {
        await Promise.resolve(
          props.onCreateTask({
            type: typeDraft,
            title: trimmedTitle,
            description: descriptionDraft,
            priority: priorityDraft,
            statusId: statusDraft
          })
        );
        props.onClose();
        return;
      }

      if (!task) return;

      const fields: Record<string, unknown> = { ...task.customFields };
      let hasFieldChanges = false;

      for (const field of visibleCustomFields) {
        const normalized = normalizeFieldValue(field, customFieldDrafts[field.id] ?? null);
        if (JSON.stringify(normalized) !== JSON.stringify(task.customFields[field.id] ?? null)) {
          fields[field.id] = normalized;
          hasFieldChanges = true;
        }
      }

      const nextStart = scheduleDraft.plannedStartAt.trim() || null;
      const nextEnd = scheduleDraft.plannedEndAt.trim() || null;
      if (nextStart !== (task.customFields.plannedStartAt ?? null) || nextEnd !== (task.customFields.plannedEndAt ?? null)) {
        fields.plannedStartAt = nextStart;
        fields.plannedEndAt = nextEnd;
        hasFieldChanges = true;
      }

      const payload: UpdateTaskInput = {};
      if (visibleFieldIdSet.has("sys:title") && trimmedTitle !== task.title) payload.title = trimmedTitle;
      if (descriptionDraft !== task.text) payload.description = descriptionDraft;
      if (visibleFieldIdSet.has("sys:type") && typeDraft !== task.type) payload.typeSlug = typeDraft;
      if (visibleFieldIdSet.has("sys:assignee") && assigneeDraft !== task.assignee) payload.assigneeId = assigneeDraft;
      if (visibleFieldIdSet.has("sys:due-date") && dueDateDraft !== normalizeDateInput(task.due)) {
        payload.dueDate = dueDateDraft.trim() || null;
      }
      if (visibleFieldIdSet.has("sys:tags") && JSON.stringify(tagsDraft) !== JSON.stringify(task.tags)) {
        payload.tags = tagsDraft;
      }
      if (statusDraft !== props.status.id) payload.stateId = statusDraft;
      if (priorityDraft !== task.priority) payload.priority = priorityDraft;
      if (
        visibleFieldIdSet.has("sys:created-by") &&
        createdByDraft.trim() !==
          (
            typeof task.customFields["createdBy"] === "string"
              ? String(task.customFields["createdBy"]).trim()
              : (props.creatorName ?? props.assignee.name).trim()
          )
      ) {
        fields.createdBy = createdByDraft.trim();
        hasFieldChanges = true;
      }
      if (hasFieldChanges) payload.fields = fields;

      if (Object.keys(payload).length === 0) return;

      await Promise.resolve(props.onSaveTask(task.id, payload));
    } catch {
      setError(isCreateMode ? "Nao foi possivel criar a tarefa." : "Nao foi possivel salvar as alteracoes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell titleId="task-details-title" className="task-details" onClose={props.onClose}>
      <header className="task-details__topbar">
        <div className="task-details__header-copy">
          <p className="task-details__breadcrumbs">{isCreateMode ? "Novo item" : "Work item"}</p>
          <h2 id="task-details-title">{isCreateMode ? "Criar tarefa" : "Editar tarefa"}</h2>
        </div>
        <button className="task-details__close" type="button" onClick={props.onClose} aria-label="Fechar editor">
          x
        </button>
      </header>

      <div
        className={`task-details__body task-details__body--compact ${
          isCreateMode ? "task-details__body--create" : "task-details__body--edit"
        }`}
      >
        <section className="task-details__main">
          <section className="task-details__panel task-details__panel--owner">
            <span className="task-details__eyebrow">Responsavel atual</span>
            {selectedAssignee ? (
              <div className="task-details__owner">
                <MemberAvatar member={selectedAssignee} />
                <div>
                  <p>{selectedAssignee.name}</p>
                  <span>{`@${selectedAssignee.initials.toLowerCase()}`}</span>
                </div>
              </div>
            ) : (
              <p className="task-details__muted">Defina quem vai conduzir esta entrega.</p>
            )}
            {availableTags.length > 0 ? (
              <div className="task-details__tag-cloud">
                {availableTags.slice(0, 6).map(tag => (
                  <span className="task-details__tag-pill" key={tag.id}>
                    {tag.name}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          <section className="task-details__hero" style={accentVars}>
            <div className="task-details__hero-accent" />
            <div className="task-details__hero-copy">
              <span className="task-details__eyebrow task-details__title-label">Titulo</span>
              <TextInput
                id="task-details-title-input"
                className="task-details__title-input"
                value={titleDraft}
                onChange={event => setTitleDraft(event.target.value)}
                placeholder="Ex: Ajustar fluxo de aprovacao com cliente"
                autoFocus
              />
            </div>
          </section>

          <section className="task-details__section">
            <div className="task-details__section-head">
              <h3 className="task-details__summary-style-title">Tags</h3>
            </div>
            <TextInput
              className="task-details__tags-input"
              value={tagsDraft.join(", ")}
              onChange={event =>
                setTagsDraft(
                  event.target.value
                    .split(",")
                    .map(entry => entry.trim())
                    .filter(Boolean)
                )
              }
              placeholder="cliente, urgente, integracao"
            />
          </section>

          <section className="task-details__section">
            <div className="task-details__section-head">
              <h3 className="task-details__summary-style-title">Descricao</h3>
            </div>
            <Textarea
              className="task-details__textarea"
              value={descriptionDraft}
              onChange={event => setDescriptionDraft(event.target.value)}
              placeholder="Descreva o contexto, o objetivo da entrega e o que precisa estar pronto ao final."
            />
          </section>

          <section className="task-details__section">
            <div className="task-details__section-head">
              <h3 className="task-details__summary-style-title">Tipo do item</h3>
            </div>
            <div className="task-details__type-grid">
              {boardConfig.taskTypes.map(taskType => {
                const meta = getTaskTypeDisplayMeta(typeMap, taskType.id);
                const isActive = typeDraft === taskType.id;

                return (
                  <button
                    key={taskType.id}
                    type="button"
                    className={`task-details__type-card ${isActive ? "is-active" : ""}`}
                    style={
                      {
                        "--task-type-background": meta.background,
                        "--task-type-border": meta.border,
                        "--task-type-text": meta.text
                      } as CSSProperties
                    }
                    onClick={() => setTypeDraft(taskType.id)}
                  >
                    <span className="task-details__type-icon">
                      <TaskTypeIcon name={resolveTaskTypeIconName(taskType.id)} />
                    </span>
                    <span className="task-details__type-label">{taskType.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="task-details__section task-details__priority-section">
            <div className="task-details__section-head">
              <h3 className="task-details__summary-style-title">Prioridade</h3>
            </div>
            <div className="task-details__priority-grid">
              {taskPriorityOptions.map(option => (
                <button
                  key={option}
                  type="button"
                  className={`task-details__priority-option ${priorityDraft === option ? "is-active" : ""}`}
                  onClick={() => setPriorityDraft(option)}
                >
                  <strong>{priorityMeta[option].label}</strong>
                </button>
              ))}
            </div>
          </section>

          {!isCreateMode && visibleFieldIdSet.has("sys:checklist") && task ? (
            <section className="task-details__section">
              <div className="task-details__section-head">
                <h3 className="task-details__summary-style-title">Checklist</h3>
                <span className="task-details__section-caption">{`${checklist.done}/${checklist.total} concluidos`}</span>
              </div>
              <div className="task-details__progress-track">
                <div className="task-details__progress-fill" style={{ width: `${checklist.percent}%` }} />
              </div>
              <ul className="task-details__checklist">
                {task.checklist.items.map(item => (
                  <li className={item.done ? "is-done" : ""} key={item.id}>
                    <button
                      type="button"
                      className="task-details__check-toggle"
                      aria-pressed={item.done}
                      onClick={() => void props.onToggleChecklistItem(task.id, item.id)}
                    >
                      {item.done ? "x" : "o"}
                    </button>
                    <p>{item.label}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </section>

        <aside className="task-details__side">
          <section className="task-details__panel task-details__panel--summary" style={accentVars}>
            <span className="task-details__eyebrow">Resumo</span>
            <div className="task-details__chips">
              <span className="task-details__chip task-details__chip--status">{activeStatusLabel}</span>
              <span className={`task-details__chip ${priority.className}`}>{priority.label}</span>
              <span className="task-details__chip task-details__chip--type">{activeTypeMeta.label}</span>
              {tagsDraft.length > 0 ? <span className="task-details__chip">{`${tagsDraft.length} tags`}</span> : null}
            </div>
          </section>

          <section className="task-details__panel task-details__panel--metadata">
            <div className="task-details__section-head">
              <h3 className="task-details__summary-style-title">Metadados</h3>
              <div className="task-details__section-head-actions">
                <button
                  type="button"
                  className="task-details__collapse-toggle"
                  onClick={() => setIsMetadataCollapsed(current => !current)}
                >
                  {isMetadataCollapsed ? "Expandir" : "Recolher"}
                </button>
              </div>
            </div>

            <div className={`task-details__meta-stack ${isMetadataCollapsed ? "is-collapsed" : ""}`}>
              <FormField label="Status">
                <Select value={statusDraft} onChange={event => setStatusDraft(event.target.value)}>
                  {statuses.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Responsavel">
                <Select value={assigneeDraft} onChange={event => setAssigneeDraft(event.target.value)}>
                  {memberOptions.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Prazo">
                <TextInput type="date" value={dueDateDraft} onChange={event => setDueDateDraft(event.target.value)} />
              </FormField>

              <div className="task-details__schedule-grid">
                <FormField label="Inicio">
                  <TextInput
                    type="datetime-local"
                    value={scheduleDraft.plannedStartAt}
                    onChange={event => setScheduleDraft(current => ({ ...current, plannedStartAt: event.target.value }))}
                  />
                </FormField>
                <FormField label="Fim">
                  <TextInput
                    type="datetime-local"
                    value={scheduleDraft.plannedEndAt}
                    onChange={event => setScheduleDraft(current => ({ ...current, plannedEndAt: event.target.value }))}
                  />
                </FormField>
              </div>

              {!isCreateMode && visibleFieldIdSet.has("sys:created-by") ? (
                <FormField label="Criado por">
                  <TextInput value={createdByDraft} onChange={event => setCreatedByDraft(event.target.value)} />
                </FormField>
              ) : null}

              {visibleCustomFields.map(field => (
                <FormField label={field.label} key={field.id}>
                  {(() => {
                    const options = getFieldOptions(field);

                    if (field.type === "select" && options.length > 0) {
                      return (
                        <Select
                          value={String(customFieldDrafts[field.id] ?? "")}
                          onChange={event =>
                            setCustomFieldDrafts(current => ({ ...current, [field.id]: event.target.value || null }))
                          }
                        >
                          <option value="">Selecione...</option>
                          {options.map(option => (
                            <option key={`${field.id}-${option}`} value={option}>
                              {option}
                            </option>
                          ))}
                        </Select>
                      );
                    }

                    if ((field.type === "multi_select" || field.type === "multi-select") && options.length > 0) {
                      const currentValues = Array.isArray(customFieldDrafts[field.id])
                        ? (customFieldDrafts[field.id] as string[])
                        : [];

                      return (
                        <div className="task-details__multi-options">
                          {options.map(option => {
                            const checked = currentValues.includes(option);
                            return (
                              <label key={`${field.id}-${option}`} className="task-details__multi-option">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={event => {
                                    const next = event.target.checked
                                      ? Array.from(new Set([...currentValues, option]))
                                      : currentValues.filter(entry => entry !== option);
                                    setCustomFieldDrafts(current => ({ ...current, [field.id]: next }));
                                  }}
                                />
                                <span>{option}</span>
                              </label>
                            );
                          })}
                        </div>
                      );
                    }

                    if (field.type === "boolean") {
                      return (
                        <label className="task-details__checkbox-row">
                          <input
                            type="checkbox"
                            checked={customFieldDrafts[field.id] === true}
                            onChange={event =>
                              setCustomFieldDrafts(current => ({ ...current, [field.id]: event.target.checked }))
                            }
                          />
                          <span>Ativado</span>
                        </label>
                      );
                    }

                    return (
                      <TextInput
                        value={
                          Array.isArray(customFieldDrafts[field.id])
                            ? (customFieldDrafts[field.id] as string[]).join(", ")
                            : String(customFieldDrafts[field.id] ?? "")
                        }
                        onChange={event =>
                          setCustomFieldDrafts(current => ({ ...current, [field.id]: event.target.value }))
                        }
                      />
                    );
                  })()}
                </FormField>
              ))}
            </div>
          </section>

          {!isCreateMode && task ? (
            <section className="task-details__panel task-details__panel--docs">
              <div className="task-details__section-head">
                <h3 className="task-details__summary-style-title">Docs vinculadas</h3>
                <span className="task-details__section-caption">{`${linkedDocuments.length} vinculada(s)`}</span>
              </div>

              {isDocsLoading ? (
                <p className="task-details__muted">Carregando docs...</p>
              ) : (
                <>
                  <div className="task-details__doc-link-row">
                    <Select
                      value={documentToLinkId}
                      onChange={(event) => setDocumentToLinkId(event.target.value)}
                      disabled={isLinkingDocument || linkableDocuments.length === 0}
                    >
                      <option value="">Selecione uma doc...</option>
                      {linkableDocuments.map((document) => (
                        <option key={document.id} value={document.id}>
                          {document.title}
                        </option>
                      ))}
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleLinkDocument()}
                      disabled={!documentToLinkId || isLinkingDocument}
                    >
                      {isLinkingDocument ? "Vinculando..." : "Vincular"}
                    </Button>
                  </div>

                  {linkedDocuments.length === 0 ? (
                    <p className="task-details__muted">Nenhuma doc vinculada a este card.</p>
                  ) : (
                    <ul className="task-details__linked-docs">
                      {linkedDocuments.map((document) => (
                        <li key={document.id}>
                          <div>
                            <strong>{document.title}</strong>
                            <span>{`Atualizada em ${new Date(document.updatedAt).toLocaleString("pt-BR")}`}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleUnlinkDocument(document.id)}
                            disabled={unlinkingDocumentId === document.id}
                          >
                            {unlinkingDocumentId === document.id ? "Removendo..." : "Remover"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {docsError ? <p className="task-details__error">{docsError}</p> : null}
            </section>
          ) : null}

          {!isCreateMode && task ? (
            <section className="task-details__panel task-details__panel--ai">
              <div className="task-details__section-head">
                <h3 className="task-details__summary-style-title">IA do card</h3>
                <span className="task-details__section-caption">
                  {linkedDocuments.length > 0 ? "Usa card + docs vinculadas" : "Usa contexto do card"}
                </span>
              </div>

              <FormField label="Agente">
                <Select value={selectedAgentId} onChange={(event) => setSelectedAgentId(event.target.value)}>
                  {editModeAiAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </Select>
              </FormField>

              <Textarea
                className="task-details__ai-textarea"
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                placeholder="Pergunte algo sobre este card e as docs vinculadas..."
              />

              <div className="task-details__ai-actions">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleRunAiOnCard()}
                  disabled={isAiRunning || editModeAiAgents.length === 0}
                >
                  {isAiRunning ? "Consultando..." : "Perguntar IA"}
                </Button>
              </div>

              <div className="task-details__ai-messages">
                {aiMessages.length === 0 ? (
                  <p className="task-details__muted">
                    A IA vai responder com base no card aberto e nas docs vinculadas.
                  </p>
                ) : (
                  aiMessages.map((message) => (
                    <article key={message.id} className={`task-details__ai-message task-details__ai-message--${message.role}`}>
                      <header>
                        <strong>
                          {message.role === "assistant" ? "IA" : message.role === "user" ? "Voce" : "Sistema"}
                        </strong>
                        <span>{new Date(message.createdAt).toLocaleTimeString("pt-BR")}</span>
                      </header>
                      <p>{message.content}</p>
                    </article>
                  ))
                )}
              </div>

              {aiError ? <p className="task-details__error">{aiError}</p> : null}
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
                ? "Preencha o essencial agora e ajuste os demais metadados depois sem trocar de interface."
                : "Mesma tela para criar e editar, com foco no preenchimento rapido e organizado."}
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
            onClick={() => void handleSubmit()}
            disabled={isCreateMode ? !canSave : !hasChanges || saving}
          >
            {saving ? (isCreateMode ? "Criando..." : "Salvando...") : isCreateMode ? "Criar tarefa" : "Salvar alteracoes"}
          </Button>
        </div>
      </footer>
    </ModalShell>
  );
}
