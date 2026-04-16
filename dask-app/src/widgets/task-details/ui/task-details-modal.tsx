import { useEffect, useMemo, useState } from "react";
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
import type { Member } from "@/entities/member";
import type { AiAgentSummary } from "@/modules/workspace/model";
import type { TaskScheduleInput, UpdateTaskInput } from "@/modules/workspace/model";
import { Button, FormField, ModalShell, Select, TextInput, Textarea } from "@/shared/ui";
import "./task-details-modal.css";

interface TaskDetailsModalProps {
  task: Task;
  status: TaskStatus;
  statuses: TaskStatus[];
  assignee: Member;
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
  onClose: () => void;
}

interface ScheduleDraft {
  plannedStartAt: string;
  plannedEndAt: string;
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

function normalizeFieldValue(definition: TaskFieldDefinition, value: TaskCustomFieldValue): TaskCustomFieldValue {
  if (definition.type === "number") {
    const asString = String(value ?? "").trim();
    if (!asString) return null;
    const parsed = Number(asString);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (definition.type === "boolean") {
    return value === true;
  }

  if (definition.type === "multi_select" || definition.type === "multi-select") {
    if (Array.isArray(value)) {
      return value.map(entry => entry.trim()).filter(Boolean);
    }

    return String(value ?? "")
      .split(",")
      .map(entry => entry.trim())
      .filter(Boolean);
  }

  return value ?? "";
}

export function TaskDetailsModal({
  task,
  status,
  statuses,
  assignee,
  creatorName,
  boardConfig,
  onSaveTask,
  onToggleChecklistItem,
  onClose
}: TaskDetailsModalProps) {
  const checklist = buildTaskChecklistSummary(task);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [descriptionDraft, setDescriptionDraft] = useState(task.text);
  const [statusDraft, setStatusDraft] = useState(status.id);
  const [priorityDraft, setPriorityDraft] = useState<TaskPriority>(task.priority);
  const [customFieldDrafts, setCustomFieldDrafts] = useState<Record<string, TaskCustomFieldValue>>({});
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft>({
    plannedStartAt: normalizeDateTimeInput(task.plannedStartAt),
    plannedEndAt: normalizeDateTimeInput(task.plannedEndAt)
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const type = useMemo(() => {
    const typeMap = buildTaskTypeMetaMap(boardConfig.taskTypes);
    return getTaskTypeDisplayMeta(typeMap, task.type);
  }, [boardConfig.taskTypes, task.type]);

  const fieldMap = useMemo(
    () =>
      boardConfig.fieldDefinitions.reduce<Record<string, TaskFieldDefinition>>((acc, field) => {
        acc[field.id] = field;
        return acc;
      }, {}),
    [boardConfig.fieldDefinitions]
  );

  const visibleCardFieldIds = useMemo(
    () =>
      resolveFieldIdsForTaskType(
        task.type,
        boardConfig.cardLayout.visibleFieldIdsByType,
        boardConfig.cardLayout.visibleFieldIds
      ),
    [boardConfig.cardLayout, task.type]
  );

  const visibleDetailFieldIds = useMemo(
    () => resolveFieldIdsForTaskType(task.type, boardConfig.cardLayout.detailVisibleFieldIdsByType, visibleCardFieldIds),
    [boardConfig.cardLayout.detailVisibleFieldIdsByType, task.type, visibleCardFieldIds]
  );

  const visibleFieldIdSet = useMemo(() => new Set(visibleDetailFieldIds), [visibleDetailFieldIds]);

  const visibleCustomFields = useMemo(
    () =>
      visibleDetailFieldIds
        .filter(fieldId => !isSystemCardFieldId(fieldId))
        .map(fieldId => fieldMap[fieldId])
        .filter((field): field is TaskFieldDefinition => Boolean(field)),
    [visibleDetailFieldIds, fieldMap]
  );

  useEffect(() => {
    setTitleDraft(task.title);
    setDescriptionDraft(task.text);
    setStatusDraft(status.id);
    setPriorityDraft(task.priority);
    setScheduleDraft({
      plannedStartAt: normalizeDateTimeInput(task.plannedStartAt),
      plannedEndAt: normalizeDateTimeInput(task.plannedEndAt)
    });
    setError("");
    setCustomFieldDrafts(
      visibleCustomFields.reduce<Record<string, TaskCustomFieldValue>>((acc, field) => {
        acc[field.id] = task.customFields[field.id] ?? null;
        return acc;
      }, {})
    );
  }, [task, status.id, visibleCustomFields]);

  const hasChanges =
    (visibleFieldIdSet.has("sys:title") && titleDraft.trim() !== task.title) ||
    descriptionDraft !== task.text ||
    statusDraft !== status.id ||
    priorityDraft !== task.priority ||
    scheduleDraft.plannedStartAt !== normalizeDateTimeInput(task.plannedStartAt) ||
    scheduleDraft.plannedEndAt !== normalizeDateTimeInput(task.plannedEndAt) ||
    visibleCustomFields.some(field => {
      const current = task.customFields[field.id] ?? null;
      const draft = normalizeFieldValue(field, customFieldDrafts[field.id] ?? null);
      return JSON.stringify(current) !== JSON.stringify(draft);
    });

  const handleSaveAll = async () => {
    const trimmedTitle = titleDraft.trim();
    if (visibleFieldIdSet.has("sys:title") && trimmedTitle.length < 2) {
      setError("O titulo precisa ter ao menos 2 caracteres.");
      return;
    }

    const start = parseDateTime(scheduleDraft.plannedStartAt);
    const end = parseDateTime(scheduleDraft.plannedEndAt);
    if (start !== null && end !== null && end <= start) {
      setError("A data final precisa ser maior que a inicial.");
      return;
    }

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
    if (statusDraft !== status.id) payload.stateId = statusDraft;
    if (priorityDraft !== task.priority) payload.priority = priorityDraft;
    if (hasFieldChanges) payload.fields = fields;

    if (Object.keys(payload).length === 0) return;

    setError("");
    setSaving(true);
    try {
      await Promise.resolve(onSaveTask(task.id, payload));
    } catch {
      setError("Nao foi possivel salvar as alteracoes.");
    } finally {
      setSaving(false);
    }
  };

  const priority = priorityMeta[priorityDraft] ?? priorityMeta[2];

  return (
    <ModalShell titleId="task-details-title" className="task-details" onClose={onClose}>
      <header className="task-details__topbar">
        <div className="task-details__breadcrumbs">Work item editor</div>
        <div className="task-details__save-center">
          <Button type="button" size="sm" variant="outline" onClick={onClose} disabled={saving}>
            Fechar
          </Button>
          <Button type="button" size="sm" onClick={() => void handleSaveAll()} disabled={saving || !hasChanges}>
            {saving ? "Salvando..." : "Salvar alteracoes"}
          </Button>
        </div>
        <button className="task-details__close" type="button" onClick={onClose} aria-label="Fechar detalhes">
          x
        </button>
      </header>

      <div className="task-details__body">
        <section className="task-details__main">
          {visibleFieldIdSet.has("sys:title") ? (
            <section className="task-details__section">
              <FormField label="Titulo">
                <TextInput id="task-details-title" value={titleDraft} onChange={event => setTitleDraft(event.target.value)} />
              </FormField>
              {error ? <p className="task-details__error">{error}</p> : null}
            </section>
          ) : null}

          {visibleFieldIdSet.has("sys:type") ? <section className="task-details__section"><h3>Tipo</h3><p>{type.label}</p></section> : null}

          {visibleFieldIdSet.has("sys:status") ? (
            <section className="task-details__section">
              <h3>Status</h3>
              <FormField label="Status atual">
                <Select value={statusDraft} onChange={event => setStatusDraft(event.target.value)}>
                  {statuses.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                </Select>
              </FormField>
            </section>
          ) : null}

          {visibleFieldIdSet.has("sys:priority") ? (
            <section className="task-details__section">
              <h3>Prioridade</h3>
              <div className="task-details__priority-control">
                <span className={`task-details__chip ${priority.className}`}>{priority.label}</span>
                <FormField label="Nivel">
                  <Select value={String(priorityDraft)} onChange={event => setPriorityDraft(Number(event.target.value) as TaskPriority)}>
                    {taskPriorityOptions.map(value => <option value={value} key={value}>{priorityMeta[value].label}</option>)}
                  </Select>
                </FormField>
              </div>
            </section>
          ) : null}

          {visibleFieldIdSet.has("sys:description") ? (
            <section className="task-details__section">
              <h3>Descricao</h3>
              <Textarea className="task-details__textarea" value={descriptionDraft} onChange={event => setDescriptionDraft(event.target.value)} />
            </section>
          ) : null}

          {visibleFieldIdSet.has("sys:schedule") ? (
            <section className="task-details__section">
              <h3>Planejamento</h3>
              <div className="task-details__schedule-grid">
                <FormField label="Inicio">
                  <TextInput type="datetime-local" value={scheduleDraft.plannedStartAt} onChange={event => setScheduleDraft(current => ({ ...current, plannedStartAt: event.target.value }))} />
                </FormField>
                <FormField label="Fim">
                  <TextInput type="datetime-local" value={scheduleDraft.plannedEndAt} onChange={event => setScheduleDraft(current => ({ ...current, plannedEndAt: event.target.value }))} />
                </FormField>
              </div>
            </section>
          ) : null}

          {visibleFieldIdSet.has("sys:assignee") ? (
            <section className="task-details__section">
              <h3>Responsavel</h3>
              <div className="task-details__owner">
                <MemberAvatar member={assignee} />
                <div><p>{assignee.name}</p><span>{`@${assignee.initials.toLowerCase()}`}</span></div>
              </div>
            </section>
          ) : null}

          {visibleFieldIdSet.has("sys:created-by") ? <section className="task-details__section"><h3>Criado por</h3><p>{creatorName ?? assignee.name}</p></section> : null}

          {visibleFieldIdSet.has("sys:checklist") ? (
            <section className="task-details__section">
              <h3>Checklist</h3>
              <div className="task-details__progress-head"><span>{`${checklist.done}/${checklist.total} concluidos`}</span><strong>{`${checklist.percent}%`}</strong></div>
              <div className="task-details__progress-track"><div className="task-details__progress-fill" style={{ width: `${checklist.percent}%` }} /></div>
              <ul className="task-details__checklist">
                {task.checklist.items.map(item => (
                  <li className={item.done ? "is-done" : ""} key={item.id}>
                    <button type="button" className="task-details__check-toggle" aria-pressed={item.done} onClick={() => void onToggleChecklistItem(task.id, item.id)}>{item.done ? "x" : "o"}</button>
                    <p>{item.label}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {visibleCustomFields.map(field => (
            <section className="task-details__section" key={field.id}>
              <h3>{field.label}</h3>
              <FormField label="Valor">
                <TextInput
                  value={Array.isArray(customFieldDrafts[field.id]) ? (customFieldDrafts[field.id] as string[]).join(", ") : String(customFieldDrafts[field.id] ?? "")}
                  onChange={event => setCustomFieldDrafts(current => ({ ...current, [field.id]: event.target.value }))}
                />
              </FormField>
            </section>
          ))}
        </section>

        <aside className="task-details__side">
          <section className="task-details__panel">
            <h4>Owner</h4>
            <div className="task-details__owner">
              <MemberAvatar member={assignee} />
              <div><p>{assignee.name}</p><span>{`@${assignee.initials.toLowerCase()}`}</span></div>
            </div>
          </section>
        </aside>
      </div>
    </ModalShell>
  );
}
