import { useEffect, useMemo, useState } from "react";
import { MemberAvatar } from "@/entities/member";
import {
  buildTaskChecklistSummary,
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
import type { AiAgentSummary } from "@/modules/workspace/model";
import type { TaskScheduleInput, UpdateTaskInput } from "@/modules/workspace/model";
import { Button, FormField, ModalShell, Select, TextInput, Textarea } from "@/shared/ui";
import "./task-details-modal.css";

interface TaskDetailsModalProps {
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

function normalizeDateInput(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function getFieldOptions(definition: TaskFieldDefinition): string[] {
  if (!Array.isArray(definition.options)) {
    return [];
  }

  return definition.options.map(option => String(option).trim()).filter(Boolean);
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

  if (definition.type === "select") {
    const asString = String(value ?? "").trim();
    return asString.length > 0 ? asString : null;
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
  membersById,
  availableTags = [],
  creatorName,
  boardConfig,
  onSaveTask,
  onToggleChecklistItem,
  onClose
}: TaskDetailsModalProps) {
  const checklist = buildTaskChecklistSummary(task);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [descriptionDraft, setDescriptionDraft] = useState(task.text);
  const [typeDraft, setTypeDraft] = useState(task.type);
  const [assigneeDraft, setAssigneeDraft] = useState(task.assignee);
  const [dueDateDraft, setDueDateDraft] = useState(normalizeDateInput(task.due));
  const [tagsDraft, setTagsDraft] = useState<string[]>(task.tags);
  const [createdByDraft, setCreatedByDraft] = useState<string>(
    typeof task.customFields["createdBy"] === "string" ? String(task.customFields["createdBy"]) : creatorName ?? assignee.name
  );
  const [statusDraft, setStatusDraft] = useState(status.id);
  const [priorityDraft, setPriorityDraft] = useState<TaskPriority>(task.priority);
  const [customFieldDrafts, setCustomFieldDrafts] = useState<Record<string, TaskCustomFieldValue>>({});
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft>({
    plannedStartAt: normalizeDateTimeInput(task.plannedStartAt),
    plannedEndAt: normalizeDateTimeInput(task.plannedEndAt)
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const memberOptions = useMemo(
    () => Object.values(membersById).sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
    [membersById]
  );

  const selectedAssignee = membersById[assigneeDraft] ?? assignee;

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
    setTypeDraft(task.type);
    setAssigneeDraft(task.assignee);
    setDueDateDraft(normalizeDateInput(task.due));
    setTagsDraft(task.tags);
    setCreatedByDraft(
      typeof task.customFields["createdBy"] === "string" ? String(task.customFields["createdBy"]) : creatorName ?? assignee.name
    );
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
  }, [task, status.id, visibleCustomFields, creatorName, assignee.name]);

  const hasChanges =
    (visibleFieldIdSet.has("sys:title") && titleDraft.trim() !== task.title) ||
    descriptionDraft !== task.text ||
    typeDraft !== task.type ||
    assigneeDraft !== task.assignee ||
    dueDateDraft !== normalizeDateInput(task.due) ||
    JSON.stringify(tagsDraft) !== JSON.stringify(task.tags) ||
    createdByDraft.trim() !==
      (
        typeof task.customFields["createdBy"] === "string"
          ? String(task.customFields["createdBy"]).trim()
          : (creatorName ?? assignee.name).trim()
      ) ||
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
    if (visibleFieldIdSet.has("sys:type") && typeDraft !== task.type) payload.typeSlug = typeDraft;
    if (visibleFieldIdSet.has("sys:assignee") && assigneeDraft !== task.assignee) payload.assigneeId = assigneeDraft;
    if (visibleFieldIdSet.has("sys:due-date") && dueDateDraft !== normalizeDateInput(task.due)) {
      payload.dueDate = dueDateDraft.trim() || null;
    }
    if (visibleFieldIdSet.has("sys:tags") && JSON.stringify(tagsDraft) !== JSON.stringify(task.tags)) {
      payload.tags = tagsDraft;
    }
    if (statusDraft !== status.id) payload.stateId = statusDraft;
    if (priorityDraft !== task.priority) payload.priority = priorityDraft;
    if (
      visibleFieldIdSet.has("sys:created-by") &&
      createdByDraft.trim() !==
        (
          typeof task.customFields["createdBy"] === "string"
            ? String(task.customFields["createdBy"]).trim()
            : (creatorName ?? assignee.name).trim()
        )
    ) {
      fields.createdBy = createdByDraft.trim();
      hasFieldChanges = true;
    }
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
  const activeTypeLabel = boardConfig.taskTypes.find(taskType => taskType.id === typeDraft)?.label ?? typeDraft;
  const activeStatusLabel = statuses.find(option => option.id === statusDraft)?.label ?? statusDraft;
  const canSave = !saving && hasChanges;

  return (
    <ModalShell titleId="task-details-title" className="task-details" onClose={onClose}>
      <header className="task-details__topbar">
        <div className="task-details__header-copy">
          <p className="task-details__breadcrumbs">Work item</p>
          <h2 id="task-details-title">{titleDraft || task.title}</h2>
        </div>
        <button className="task-details__close" type="button" onClick={onClose} aria-label="Fechar detalhes">
          x
        </button>
      </header>

      <div className="task-details__body">
        <section className="task-details__main">
          {visibleFieldIdSet.has("sys:title") ? (
            <section className="task-details__section task-details__section--hero">
              <FormField label="Titulo">
                <TextInput id="task-details-title-input" value={titleDraft} onChange={event => setTitleDraft(event.target.value)} />
              </FormField>
            </section>
          ) : null}

          <section className="task-details__section task-details__section--properties">
            <div className="task-details__section-head">
              <h3>Propriedades</h3>
            </div>
            <div className="task-details__properties-grid">
              {visibleFieldIdSet.has("sys:type") ? (
                <FormField label="Tipo atual">
                  <Select value={typeDraft} onChange={event => setTypeDraft(event.target.value)}>
                    {boardConfig.taskTypes.map(taskType => (
                      <option key={taskType.id} value={taskType.id}>
                        {taskType.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              ) : null}

              {visibleFieldIdSet.has("sys:status") ? (
                <FormField label="Status atual">
                  <Select value={statusDraft} onChange={event => setStatusDraft(event.target.value)}>
                    {statuses.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </Select>
                </FormField>
              ) : null}

              {visibleFieldIdSet.has("sys:priority") ? (
                <FormField label="Prioridade">
                  <Select value={String(priorityDraft)} onChange={event => setPriorityDraft(Number(event.target.value) as TaskPriority)}>
                    {taskPriorityOptions.map(value => <option value={value} key={value}>{priorityMeta[value].label}</option>)}
                  </Select>
                </FormField>
              ) : null}

              {visibleFieldIdSet.has("sys:assignee") ? (
                <FormField label="Responsavel">
                  <Select value={assigneeDraft} onChange={event => setAssigneeDraft(event.target.value)}>
                    {memberOptions.map(member => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              ) : null}

              {visibleFieldIdSet.has("sys:due-date") ? (
                <FormField label="Prazo">
                  <TextInput type="date" value={dueDateDraft} onChange={event => setDueDateDraft(event.target.value)} />
                </FormField>
              ) : null}
            </div>
          </section>

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

          {visibleFieldIdSet.has("sys:tags") ? (
            <section className="task-details__section">
              <h3>Tags</h3>
              {availableTags.length > 0 ? (
                <div className="task-details__multi-options">
                  {availableTags.map(tag => {
                    const checked = tagsDraft.includes(tag.name);
                    return (
                      <label key={tag.id} className="task-details__multi-option">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={event => {
                            const next = event.target.checked
                              ? Array.from(new Set([...tagsDraft, tag.name]))
                              : tagsDraft.filter(entry => entry !== tag.name);
                            setTagsDraft(next);
                          }}
                        />
                        <span>{tag.name}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <FormField label="Tags (separadas por virgula)">
                  <TextInput
                    value={tagsDraft.join(", ")}
                    onChange={event =>
                      setTagsDraft(
                        event.target.value
                          .split(",")
                          .map(entry => entry.trim())
                          .filter(Boolean)
                      )
                    }
                  />
                </FormField>
              )}
            </section>
          ) : null}

          {visibleFieldIdSet.has("sys:created-by") ? (
            <section className="task-details__section">
              <h3>Criado por</h3>
              <FormField label="Nome exibido">
                <TextInput value={createdByDraft} onChange={event => setCreatedByDraft(event.target.value)} />
              </FormField>
            </section>
          ) : null}

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
                {(() => {
                  const options = getFieldOptions(field);

                  if (field.type === "select" && options.length > 0) {
                    return (
                      <Select
                        value={String(customFieldDrafts[field.id] ?? "")}
                        onChange={event => setCustomFieldDrafts(current => ({ ...current, [field.id]: event.target.value || null }))}
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
                          onChange={event => setCustomFieldDrafts(current => ({ ...current, [field.id]: event.target.checked }))}
                        />
                        <span>Valor verdadeiro</span>
                      </label>
                    );
                  }

                  return (
                    <TextInput
                      value={Array.isArray(customFieldDrafts[field.id]) ? (customFieldDrafts[field.id] as string[]).join(", ") : String(customFieldDrafts[field.id] ?? "")}
                      onChange={event => setCustomFieldDrafts(current => ({ ...current, [field.id]: event.target.value }))}
                    />
                  );
                })()}
              </FormField>
            </section>
          ))}
        </section>

        <aside className="task-details__side">
          <section className="task-details__panel">
            <h4>Painel rapido</h4>
            <div className="task-details__chips">
              <span className="task-details__chip task-details__chip--status">{activeStatusLabel}</span>
              <span className={`task-details__chip ${priority.className}`}>{priority.label}</span>
              <span className="task-details__chip">{activeTypeLabel}</span>
            </div>
            <div className="task-details__divider" />
            <div className="task-details__owner">
              <MemberAvatar member={selectedAssignee} />
              <div><p>{selectedAssignee.name}</p><span>{`@${selectedAssignee.initials.toLowerCase()}`}</span></div>
            </div>
            <div className="task-details__summary-list">
              <span><strong>{tagsDraft.length}</strong> tags</span>
              <span><strong>{visibleCustomFields.length}</strong> campos custom</span>
            </div>
          </section>
        </aside>
      </div>
      <footer className="task-details__actionbar">
        <div className="task-details__actionbar-copy">
          {error ? <p className="task-details__error">{error}</p> : <p>As alteracoes ficam salvas no card e no board em tempo real.</p>}
        </div>
        <div className="task-details__actionbar-actions">
          <Button type="button" size="sm" variant="outline" onClick={onClose} disabled={saving}>
            Fechar
          </Button>
          <Button type="button" size="sm" onClick={() => void handleSaveAll()} disabled={!canSave}>
            {saving ? "Salvando..." : "Salvar alteracoes"}
          </Button>
        </div>
      </footer>
    </ModalShell>
  );
}
