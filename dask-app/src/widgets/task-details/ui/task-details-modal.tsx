import { useEffect, useMemo, useState } from "react";
import { MemberAvatar } from "@/entities/member";
import {
  buildTaskChecklistSummary,
  buildTaskTypeMetaMap,
  getTaskTypeDisplayMeta,
  isSystemCardFieldId,
  priorityMeta,
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
import type { TaskScheduleInput } from "@/modules/workspace/model";
import { Button, FormField, ModalShell, Select, TextInput, Textarea } from "@/shared/ui";
import "./task-details-modal.css";

interface TaskDetailsModalProps {
  task: Task;
  status: TaskStatus;
  statuses: TaskStatus[];
  assignee: Member;
  creatorName?: string;
  boardConfig: BoardConfig;
  onUpdatePriority: (taskId: string, priority: TaskPriority) => Promise<void> | void;
  onUpdateStatus: (taskId: string, statusId: TaskStatusId) => Promise<void> | void;
  onUpdateTitle: (taskId: string, title: string) => Promise<void> | void;
  onUpdateDescription: (taskId: string, description: string) => Promise<void> | void;
  onUpdateCustomField: (
    taskId: string,
    fieldId: string,
    value: TaskCustomFieldValue
  ) => Promise<void> | void;
  onUpdateSchedule: (taskId: string, input: TaskScheduleInput) => Promise<void> | void;
  onToggleChecklistItem: (taskId: string, itemId: string) => Promise<void> | void;
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

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface ScheduleDraft {
  plannedStartAt: string;
  plannedEndAt: string;
}

const initialAssistantMessage =
  "Sou o assistente do card. Posso te ajudar a quebrar escopo, revisar riscos e preparar handoff para o time.";

function normalizeFieldType(type: TaskFieldDefinition["type"]): TaskFieldDefinition["type"] {
  return type === "multi-select" ? "multi_select" : type;
}

function canEnhanceWithAi(definition: Pick<TaskFieldDefinition, "type" | "capabilities">): boolean {
  if (typeof definition.capabilities?.aiEnhance === "boolean") {
    return definition.capabilities.aiEnhance;
  }

  return definition.type === "text_ai";
}

function toInputString(value: TaskCustomFieldValue): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (value === null || typeof value === "undefined") {
    return "";
  }

  return String(value);
}

function parseDateTime(value: string | null | undefined): number | null {
  if (!value || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function normalizeDateTimeInput(value: string | null | undefined): string {
  if (!value || value.trim().length === 0) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const pad = (entry: number) => entry.toString().padStart(2, "0");
  const year = parsed.getFullYear();
  const month = pad(parsed.getMonth() + 1);
  const day = pad(parsed.getDate());
  const hours = pad(parsed.getHours());
  const minutes = pad(parsed.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function buildScheduleDraft(task: Task): ScheduleDraft {
  return {
    plannedStartAt: normalizeDateTimeInput(task.plannedStartAt),
    plannedEndAt: normalizeDateTimeInput(task.plannedEndAt)
  };
}

function formatCustomFieldValue(value: TaskCustomFieldValue, definition: TaskFieldDefinition): string {
  const type = normalizeFieldType(definition.type);

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (type === "boolean") {
    return value ? "Sim" : "Nao";
  }

  if (value === null || typeof value === "undefined" || value === "") {
    return "-";
  }

  return String(value);
}

function buildAiSuggestion(fieldLabel: string, baseText: string, taskTitle: string): string {
  const normalized = baseText.trim();
  const content = normalized.length > 0 ? normalized : `Definir ${fieldLabel.toLowerCase()} de forma objetiva.`;

  return [
    `Contexto: ${taskTitle}`,
    "",
    `Campo: ${fieldLabel}`,
    content,
    "",
    "Versao aprimorada:",
    "- Mais clara e acionavel",
    "- Com objetivo e resultado esperado",
    "- Com criterio de aceite explicito"
  ].join("\n");
}

function normalizeCustomFieldValue(
  definition: TaskFieldDefinition,
  rawValue: TaskCustomFieldValue
): TaskCustomFieldValue {
  const type = normalizeFieldType(definition.type);

  if (type === "number") {
    const value = toInputString(rawValue).trim();
    if (value.length === 0) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (type === "boolean") {
    return rawValue === true;
  }

  if (type === "multi_select") {
    if (Array.isArray(rawValue)) {
      return rawValue.map(entry => entry.trim()).filter(entry => entry.length > 0);
    }

    return toInputString(rawValue)
      .split(",")
      .map(entry => entry.trim())
      .filter(entry => entry.length > 0);
  }

  if (rawValue === null || typeof rawValue === "undefined") {
    return "";
  }

  return toInputString(rawValue);
}

export function TaskDetailsModal({
  task,
  status,
  statuses,
  assignee,
  creatorName,
  boardConfig,
  onUpdatePriority,
  onUpdateStatus,
  onUpdateTitle,
  onUpdateDescription,
  onUpdateCustomField,
  onUpdateSchedule,
  onToggleChecklistItem,
  aiAgents,
  onRunAiAgentOnItem,
  onRunAiRiskAnalysis,
  onClose
}: TaskDetailsModalProps) {
  const checklistItems = task.checklist.items;
  const checklist = buildTaskChecklistSummary(task);
  const priority = priorityMeta[task.priority] ?? priorityMeta[2];

  const [titleDraft, setTitleDraft] = useState(task.title);
  const [descriptionDraft, setDescriptionDraft] = useState(task.text);
  const [customFieldDrafts, setCustomFieldDrafts] = useState<Record<string, TaskCustomFieldValue>>({});
  const [aiSuggestionByFieldId, setAiSuggestionByFieldId] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft>(() => buildScheduleDraft(task));
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [isRunningAi, setIsRunningAi] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: `${task.id}-assistant-1`,
      role: "assistant",
      text: initialAssistantMessage
    }
  ]);

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

  const visibleDetailFieldIds = useMemo(
    () =>
      boardConfig.cardLayout.detailVisibleFieldIdsByType?.[task.type] ??
      boardConfig.cardLayout.visibleFieldIdsByType?.[task.type] ??
      [],
    [boardConfig.cardLayout, task.type]
  );

  const visibleFieldIdSet = useMemo(() => new Set(visibleDetailFieldIds), [visibleDetailFieldIds]);

  const visibleCustomFields = useMemo(
    () =>
      visibleDetailFieldIds
        .filter(fieldId => !isSystemCardFieldId(fieldId))
        .map(fieldId => fieldMap[fieldId])
        .filter((definition): definition is TaskFieldDefinition => Boolean(definition)),
    [fieldMap, visibleDetailFieldIds]
  );

  useEffect(() => {
    setTitleDraft(task.title);
    setDescriptionDraft(task.text);
    setScheduleDraft(buildScheduleDraft(task));
    setScheduleError(null);
    setAiSuggestionByFieldId({});
    setSavingKey(null);

    setCustomFieldDrafts(() =>
      visibleCustomFields.reduce<Record<string, TaskCustomFieldValue>>((acc, definition) => {
        acc[definition.id] = task.customFields[definition.id] ?? null;
        return acc;
      }, {})
    );

    setChatInput("");
    setSelectedAgentId(current => {
      if (current && aiAgents.some(agent => agent.id === current && agent.isActive)) {
        return current;
      }
      const fallback = aiAgents.find(agent => agent.isDefault && agent.isActive) ?? aiAgents.find(agent => agent.isActive);
      return fallback?.id ?? "";
    });
    setChatMessages([
      {
        id: `${task.id}-assistant-1`,
        role: "assistant",
        text: initialAssistantMessage
      }
    ]);
  }, [task.id, task.title, task.text, task.plannedStartAt, task.plannedEndAt, task.customFields, visibleCustomFields, aiAgents]);

  const runMutation = async (key: string, mutation: () => Promise<void> | void) => {
    setSavingKey(key);
    try {
      await Promise.resolve(mutation());
    } finally {
      setSavingKey(current => (current === key ? null : current));
    }
  };

  const handleSaveTitle = () => {
    const nextTitle = titleDraft.trim();
    if (nextTitle.length < 2 || nextTitle === task.title) {
      return;
    }

    void runMutation("sys:title", () => onUpdateTitle(task.id, nextTitle));
  };

  const handleSaveDescription = () => {
    if (descriptionDraft === task.text) {
      return;
    }

    void runMutation("sys:description", () => onUpdateDescription(task.id, descriptionDraft));
  };

  const handleSaveCustomField = (definition: TaskFieldDefinition) => {
    const rawValue = customFieldDrafts[definition.id] ?? null;
    const nextValue = normalizeCustomFieldValue(definition, rawValue);
    void runMutation(definition.id, () => onUpdateCustomField(task.id, definition.id, nextValue));
  };

  const handleGenerateAiForField = (fieldId: string, fieldLabel: string, content: string) => {
    setAiSuggestionByFieldId(current => ({
      ...current,
      [fieldId]: buildAiSuggestion(fieldLabel, content, task.title)
    }));
  };

  const handleSaveSchedule = async () => {
    const startValue = scheduleDraft.plannedStartAt.trim();
    const endValue = scheduleDraft.plannedEndAt.trim();
    const startStamp = parseDateTime(startValue);
    const endStamp = parseDateTime(endValue);

    if (startStamp !== null && endStamp !== null && endStamp <= startStamp) {
      setScheduleError("A hora final precisa ser maior que a hora inicial.");
      return;
    }

    setScheduleError(null);
    await runMutation("sys:schedule", () =>
      onUpdateSchedule(task.id, {
        plannedStartAt: startValue.length > 0 ? startValue : null,
        plannedEndAt: endValue.length > 0 ? endValue : null
      })
    );
  };

  const handleApplyAiSuggestion = (fieldId: string, apply: (value: string) => void) => {
    const suggestion = aiSuggestionByFieldId[fieldId];
    if (!suggestion) {
      return;
    }

    apply(suggestion);
    setAiSuggestionByFieldId(current => {
      const next = { ...current };
      delete next[fieldId];
      return next;
    });
  };

  const handleSendChat = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || !selectedAgentId || isRunningAi) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `${task.id}-user-${Date.now()}`,
      role: "user",
      text: trimmed
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");

    setIsRunningAi(true);
    try {
      const result = await onRunAiAgentOnItem(task.id, selectedAgentId, {
        instruction: trimmed,
        includeSemanticContext: true,
        topKContextDocs: 5
      });

      const assistantMessage: ChatMessage = {
        id: `${task.id}-assistant-${Date.now() + 1}`,
        role: "assistant",
        text: result.content
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch {
      setChatMessages(prev => [
        ...prev,
        {
          id: `${task.id}-assistant-error-${Date.now()}`,
          role: "assistant",
          text: "Nao consegui executar o agente agora. Tente novamente em alguns segundos."
        }
      ]);
    } finally {
      setIsRunningAi(false);
    }
  };

  const handleRunRiskAnalysis = async () => {
    if (isRunningAi) {
      return;
    }

    setIsRunningAi(true);
    try {
      const result = await onRunAiRiskAnalysis(task.id, {
        includeSemanticContext: true,
        topKContextDocs: 5
      });
      setChatMessages(prev => [
        ...prev,
        {
          id: `${task.id}-assistant-risk-${Date.now()}`,
          role: "assistant",
          text: result.content
        }
      ]);
    } catch {
      setChatMessages(prev => [
        ...prev,
        {
          id: `${task.id}-assistant-risk-error-${Date.now()}`,
          role: "assistant",
          text: "Nao consegui gerar a analise de risco no momento."
        }
      ]);
    } finally {
      setIsRunningAi(false);
    }
  };

  const renderCustomFieldInput = (definition: TaskFieldDefinition) => {
    const typeKey = normalizeFieldType(definition.type);
    const value = customFieldDrafts[definition.id] ?? task.customFields[definition.id] ?? null;
    const aiSuggestion = aiSuggestionByFieldId[definition.id] ?? "";
    const saving = savingKey === definition.id;

    if (typeKey === "boolean") {
      return (
        <>
          <label className="task-details__checkbox-row">
            <input
              type="checkbox"
              checked={value === true}
              onChange={event =>
                setCustomFieldDrafts(current => ({
                  ...current,
                  [definition.id]: event.target.checked
                }))
              }
            />
            <span>{value === true ? "Ativado" : "Desativado"}</span>
          </label>
          <div className="task-details__actions-row">
            <Button type="button" size="sm" onClick={() => handleSaveCustomField(definition)} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </>
      );
    }

    if (typeKey === "select") {
      const selectedValue = toInputString(value);

      return (
        <>
          <FormField label="Valor">
            <Select
              value={selectedValue}
              onChange={event =>
                setCustomFieldDrafts(current => ({
                  ...current,
                  [definition.id]: event.target.value
                }))
              }
            >
              <option value="">Selecione</option>
              {(definition.options ?? []).map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="task-details__actions-row">
            <Button type="button" size="sm" onClick={() => handleSaveCustomField(definition)} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </>
      );
    }

    if (typeKey === "multi_select") {
      const selectedValue = toInputString(value);

      return (
        <>
          <FormField label="Valores (separados por virgula)">
            <TextInput
              value={selectedValue}
              onChange={event =>
                setCustomFieldDrafts(current => ({
                  ...current,
                  [definition.id]: event.target.value
                }))
              }
            />
          </FormField>
          <div className="task-details__actions-row">
            <Button type="button" size="sm" onClick={() => handleSaveCustomField(definition)} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </>
      );
    }

    if (typeKey === "number" || typeKey === "date" || typeKey === "datetime") {
      const inputType = typeKey === "number" ? "number" : typeKey === "datetime" ? "datetime-local" : "date";

      return (
        <>
          <FormField label="Valor">
            <TextInput
              type={inputType}
              value={toInputString(value)}
              onChange={event =>
                setCustomFieldDrafts(current => ({
                  ...current,
                  [definition.id]: event.target.value
                }))
              }
            />
          </FormField>
          <div className="task-details__actions-row">
            <Button type="button" size="sm" onClick={() => handleSaveCustomField(definition)} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </>
      );
    }

    const textValue = toInputString(value);
    const aiEnabled = canEnhanceWithAi(definition);

    return (
      <>
        <FormField label="Conteudo">
          <Textarea
            className="task-details__textarea"
            value={textValue}
            onChange={event =>
              setCustomFieldDrafts(current => ({
                ...current,
                [definition.id]: event.target.value
              }))
            }
          />
        </FormField>
        <div className="task-details__actions-row">
          {aiEnabled ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleGenerateAiForField(definition.id, definition.label, textValue)}
            >
              Aprimorar
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={() => handleSaveCustomField(definition)} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
        {aiSuggestion ? (
          <div className="task-details__inline-ai">
            <pre className="task-details__ai-suggestion">{aiSuggestion}</pre>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                handleApplyAiSuggestion(definition.id, suggestion =>
                  setCustomFieldDrafts(current => ({
                    ...current,
                    [definition.id]: suggestion
                  }))
                )
              }
            >
              Usar sugestao
            </Button>
          </div>
        ) : null}
      </>
    );
  };

  const hasVisibleSections = visibleDetailFieldIds.length > 0;

  return (
    <ModalShell titleId="task-details-title" className="task-details" onClose={onClose}>
      <header className="task-details__topbar">
        <div className="task-details__breadcrumbs">Task details</div>
        <button className="task-details__close" type="button" onClick={onClose} aria-label="Fechar detalhes">
          x
        </button>
      </header>

      <div className="task-details__body">
        <section className="task-details__main">
          <h2 id="task-details-title" className="task-details__title">
            {task.title}
          </h2>

          {!hasVisibleSections ? (
            <section className="task-details__section">
              <h3>Nenhum campo selecionado</h3>
              <p>Este tipo de work item esta sem campos habilitados no modo expandido.</p>
            </section>
          ) : null}

          {visibleFieldIdSet.has("sys:type") ? (
            <section className="task-details__section">
              <h3>Tipo</h3>
              <p>{type.label}</p>
            </section>
          ) : null}

          {visibleFieldIdSet.has("sys:status") ? (
            <section className="task-details__section">
              <h3>State do card</h3>
              <FormField label="State atual">
                <Select value={status.id} onChange={event => void onUpdateStatus(task.id, event.target.value)}>
                  {statuses.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FormField>
            </section>
          ) : null}

          {visibleFieldIdSet.has("sys:priority") ? (
            <section className="task-details__section">
              <h3>Prioridade</h3>
              <div className="task-details__priority-control">
                <span className={`task-details__chip ${priority.className}`}>{priority.label}</span>
                <FormField label="Nivel de prioridade (0 a 4)">
                  <Select
                    value={String(task.priority)}
                    onChange={event => void onUpdatePriority(task.id, Number(event.target.value) as TaskPriority)}
                  >
                    {taskPriorityOptions.map(value => (
                      <option value={value} key={value}>
                        {priorityMeta[value].label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
            </section>
          ) : null}

          {visibleFieldIdSet.has("sys:title") ? (
            <section className="task-details__section">
              <div className="task-details__section-head">
                <h3>Titulo</h3>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveTitle}
                  disabled={savingKey === "sys:title" || titleDraft.trim().length < 2 || titleDraft.trim() === task.title}
                >
                  {savingKey === "sys:title" ? "Salvando..." : "Salvar"}
                </Button>
              </div>
              <TextInput value={titleDraft} onChange={event => setTitleDraft(event.target.value)} />
            </section>
          ) : null}

          {visibleFieldIdSet.has("sys:description") ? (
            <section className="task-details__section">
              <div className="task-details__section-head">
                <h3>Descricao</h3>
              </div>
              <FormField label="Conteudo">
                <Textarea
                  className="task-details__textarea"
                  value={descriptionDraft}
                  onChange={event => setDescriptionDraft(event.target.value)}
                />
              </FormField>
              <div className="task-details__actions-row">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleGenerateAiForField("sys:description", "Descricao", descriptionDraft)}
                >
                  Aprimorar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveDescription}
                  disabled={savingKey === "sys:description" || descriptionDraft === task.text}
                >
                  {savingKey === "sys:description" ? "Salvando..." : "Salvar"}
                </Button>
              </div>
              {aiSuggestionByFieldId["sys:description"] ? (
                <div className="task-details__inline-ai">
                  <pre className="task-details__ai-suggestion">{aiSuggestionByFieldId["sys:description"]}</pre>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleApplyAiSuggestion("sys:description", suggestion => setDescriptionDraft(suggestion))
                    }
                  >
                    Usar sugestao
                  </Button>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="task-details__section">
            <div className="task-details__section-head">
              <h3>Planejamento</h3>
              <Button type="button" size="sm" onClick={() => void handleSaveSchedule()} disabled={savingKey === "sys:schedule"}>
                {savingKey === "sys:schedule" ? "Salvando..." : "Salvar horario"}
              </Button>
            </div>
            <div className="task-details__schedule-grid">
              <FormField label="Inicio">
                <TextInput
                  type="datetime-local"
                  value={scheduleDraft.plannedStartAt}
                  onChange={event => {
                    setScheduleDraft(current => ({ ...current, plannedStartAt: event.target.value }));
                    if (scheduleError) {
                      setScheduleError(null);
                    }
                  }}
                />
              </FormField>
              <FormField label="Fim">
                <TextInput
                  type="datetime-local"
                  value={scheduleDraft.plannedEndAt}
                  onChange={event => {
                    setScheduleDraft(current => ({ ...current, plannedEndAt: event.target.value }));
                    if (scheduleError) {
                      setScheduleError(null);
                    }
                  }}
                />
              </FormField>
            </div>
            {scheduleError ? <p className="task-details__error">{scheduleError}</p> : null}
          </section>

          {visibleFieldIdSet.has("sys:created-by") ? (
            <section className="task-details__section">
              <h3>Criado por</h3>
              <p>{creatorName ?? assignee.name}</p>
            </section>
          ) : null}

          {visibleFieldIdSet.has("sys:assignee") ? (
            <section className="task-details__section">
              <h3>Responsavel</h3>
              <div className="task-details__owner">
                <MemberAvatar member={assignee} />
                <div>
                  <p>{assignee.name}</p>
                  <span>{`@${assignee.initials.toLowerCase()}`}</span>
                </div>
              </div>
            </section>
          ) : null}

          {visibleFieldIdSet.has("sys:checklist") ? (
            <section className="task-details__section">
              <h3>Checklist</h3>
              <div className="task-details__progress-head">
                <span>{`${checklist.done}/${checklist.total} concluidos`}</span>
                <strong>{`${checklist.percent}%`}</strong>
              </div>
              <div className="task-details__progress-track">
                <div className="task-details__progress-fill" style={{ width: `${checklist.percent}%` }} />
              </div>
              <ul className="task-details__checklist">
                {checklistItems.map(item => (
                  <li className={item.done ? "is-done" : ""} key={item.id}>
                    <button
                      type="button"
                      className="task-details__check-toggle"
                      aria-pressed={item.done}
                      onClick={() => void onToggleChecklistItem(task.id, item.id)}
                    >
                      {item.done ? "x" : "o"}
                    </button>
                    <p>{item.label}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {visibleFieldIdSet.has("sys:due-date") ? (
            <section className="task-details__section">
              <h3>Prazo</h3>
              <p>{task.due ? `Prazo ${task.due}` : "Sem prazo"}</p>
            </section>
          ) : null}

          {visibleFieldIdSet.has("sys:tags") ? (
            <section className="task-details__section">
              <h3>Tags</h3>
              <div className="task-details__tags">
                {task.tags.length > 0 ? (
                  task.tags.map(tag => (
                    <span key={tag} className="task-details__tag">
                      {tag}
                    </span>
                  ))
                ) : (
                  <p>Sem tags</p>
                )}
              </div>
            </section>
          ) : null}

          {visibleCustomFields.map(definition => (
            <section className="task-details__section" key={definition.id}>
              <h3>{definition.label}</h3>
              {renderCustomFieldInput(definition)}
              {savingKey !== definition.id && customFieldDrafts[definition.id] === task.customFields[definition.id] ? null : (
                <p className="task-details__field-hint">
                  Valor atual: {formatCustomFieldValue(task.customFields[definition.id] ?? null, definition)}
                </p>
              )}
            </section>
          ))}
        </section>

        <aside className="task-details__side">
          <section className="task-details__panel">
            <h4>Owner</h4>
            <div className="task-details__owner">
              <MemberAvatar member={assignee} />
              <div>
                <p>{assignee.name}</p>
                <span>{`@${assignee.initials.toLowerCase()}`}</span>
              </div>
            </div>
          </section>

          <section className="task-details__panel">
            <h4>Chat do card</h4>
            <div className="task-details__chat-list">
              {chatMessages.map(message => (
                <article
                  className={`task-details__chat-item ${message.role === "assistant" ? "is-assistant" : "is-user"}`}
                  key={message.id}
                >
                  <strong>{message.role === "assistant" ? "Dask Copilot" : "Voce"}</strong>
                  <p>{message.text}</p>
                </article>
              ))}
            </div>
            <div className="task-details__chat-input-wrap">
              <FormField label="Agente">
                <Select
                  value={selectedAgentId}
                  onChange={event => setSelectedAgentId(event.target.value)}
                  disabled={isRunningAi || aiAgents.length === 0}
                >
                  {aiAgents.length === 0 ? <option value="">Nenhum agente ativo</option> : null}
                  {aiAgents
                    .filter(agent => agent.isActive)
                    .map(agent => (
                      <option value={agent.id} key={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                </Select>
              </FormField>
              <Textarea
                className="task-details__chat-input"
                placeholder="Pergunte algo sobre este card"
                value={chatInput}
                onChange={event => setChatInput(event.target.value)}
              />
              <div className="task-details__actions-row">
                <Button type="button" size="sm" variant="outline" onClick={() => void handleRunRiskAnalysis()} disabled={isRunningAi}>
                  {isRunningAi ? "Processando..." : "Analisar riscos"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleSendChat()}
                  disabled={isRunningAi || chatInput.trim().length === 0 || selectedAgentId.length === 0}
                >
                  {isRunningAi ? "Processando..." : "Enviar"}
                </Button>
              </div>
            </div>
          </section>

          <section className="task-details__panel">
            <h4>Atividade</h4>
            <ul className="task-details__activity">
              <li>
                <strong>{assignee.name}</strong>
                <span>Atualizou a checklist hoje</span>
              </li>
              <li>
                <strong>Dask Bot</strong>
                <span>Sincronizou o status com o board</span>
              </li>
              <li>
                <strong>{creatorName ?? assignee.name}</strong>
                <span>Criou esta tarefa</span>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </ModalShell>
  );
}
