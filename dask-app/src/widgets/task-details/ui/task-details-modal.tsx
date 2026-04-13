import { useEffect, useMemo, useState } from "react";
import { MemberAvatar } from "@/entities/member";
import {
  buildTaskChecklistSummary,
  buildTaskTypeMetaMap,
  getTaskTypeDisplayMeta,
  priorityMeta,
  taskPriorityOptions
} from "@/entities/task";
import type {
  BoardConfig,
  Task,
  TaskCustomFieldValue,
  TaskPriority,
  TaskFieldDefinition,
  TaskStatus
} from "@/entities/task";
import type { Member } from "@/entities/member";
import { Button, FormField, ModalShell, Select, Textarea } from "@/shared/ui";
import "./task-details-modal.css";

interface TaskDetailsModalProps {
  task: Task;
  status: TaskStatus;
  assignee: Member;
  boardConfig: BoardConfig;
  onUpdatePriority: (taskId: string, priority: TaskPriority) => void;
  onToggleChecklistItem: (taskId: string, itemId: string) => void;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const longDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" });
const initialAssistantMessage =
  "Sou o assistente do card. Posso te ajudar a quebrar escopo, revisar riscos e preparar handoff para o time.";

function formatCustomFieldValue(value: TaskCustomFieldValue, definition: TaskFieldDefinition): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (definition.type === "boolean") {
    return value ? "Sim" : "Nao";
  }

  if (value === null || typeof value === "undefined" || value === "") {
    return "-";
  }

  return String(value);
}

function createAiSuggestion(baseText: string): string {
  const normalized = baseText.trim();
  const input = normalized.length > 0 ? normalized : "Definir objetivo principal da entrega.";

  return [
    "Contexto",
    input,
    "",
    "Objetivo",
    "Entregar valor de negocio com criterio de aceite claro e medicao de resultado.",
    "",
    "Escopo",
    "- Fluxo principal mapeado",
    "- Dependencias e riscos explicitados",
    "- Alinhamento com stakeholders e QA",
    "",
    "Criterios de aceite",
    "- Comportamento validado no cenario principal",
    "- Evidencia de teste anexada",
    "- Sem regressao em funcionalidades relacionadas"
  ].join("\n");
}

export function TaskDetailsModal({
  task,
  status,
  assignee,
  boardConfig,
  onUpdatePriority,
  onToggleChecklistItem,
  onClose
}: TaskDetailsModalProps) {
  const checklistItems = task.checklist.items;
  const checklist = buildTaskChecklistSummary(task);
  const priority = priorityMeta[task.priority] ?? priorityMeta[2];

  const [descriptionDraft, setDescriptionDraft] = useState(task.text);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [chatInput, setChatInput] = useState("");
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

  const customFields = useMemo(() => {
    return boardConfig.fieldDefinitions
      .map(definition => ({
        definition,
        value: task.customFields[definition.id]
      }))
      .filter(item => typeof item.value !== "undefined");
  }, [boardConfig.fieldDefinitions, task.customFields]);

  useEffect(() => {
    setDescriptionDraft(task.text);
    setAiSuggestion("");
    setChatInput("");
    setChatMessages([
      {
        id: `${task.id}-assistant-1`,
        role: "assistant",
        text: initialAssistantMessage
      }
    ]);
  }, [task.id, task.text]);

  const handleGenerateSuggestion = () => {
    setAiSuggestion(createAiSuggestion(descriptionDraft));
  };

  const handleSendChat = () => {
    const trimmed = chatInput.trim();
    if (!trimmed) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `${task.id}-user-${Date.now()}`,
      role: "user",
      text: trimmed
    };

    const assistantMessage: ChatMessage = {
      id: `${task.id}-assistant-${Date.now() + 1}`,
      role: "assistant",
      text: `Entendido. Sobre "${task.title}", vou considerar esse ponto e sugerir uma proxima acao objetiva para o time.`
    };

    setChatMessages(prev => [...prev, userMessage, assistantMessage]);
    setChatInput("");
  };

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

            <div className="task-details__chips">
              <span
                className="task-details__chip"
                style={{
                  backgroundColor: type.background,
                  borderColor: type.border,
                  color: type.text
                }}
              >
                {type.label}
              </span>
              <span className="task-details__chip task-details__chip--status">
                <span className="task-details__status-dot" style={{ background: status.dot }} />
                {status.label}
              </span>
              <span className={`task-details__chip ${priority.className}`}>{priority.label}</span>
              {task.due ? (
                <span className="task-details__chip">
                  {(() => {
                    const d = new Date(task.due);
                    return isNaN(d.getTime()) ? "Sem prazo" : `Prazo ${longDate.format(d)}`;
                  })()}
                </span>
              ) : (
                <span className="task-details__chip">Sem prazo</span>
              )}
            </div>

            <section className="task-details__section">
              <h3>Prioridade</h3>
              <div className="task-details__priority-control">
                <span className={`task-details__chip ${priority.className}`}>{priority.label}</span>
                <FormField label="Nivel de prioridade (0 a 4)">
                  <Select
                    value={String(task.priority)}
                    onChange={event => onUpdatePriority(task.id, Number(event.target.value) as TaskPriority)}
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

            <section className="task-details__section">
              <h3>Descricao</h3>
              <p>{task.text}</p>
            </section>

            <section className="task-details__section">
              <h3>Aprimorar descricao com IA</h3>
              <FormField label="Descricao refinada">
                <Textarea
                  className="task-details__textarea"
                  value={descriptionDraft}
                  onChange={event => setDescriptionDraft(event.target.value)}
                />
              </FormField>
              <div className="task-details__actions-row">
                <Button type="button" size="sm" onClick={handleGenerateSuggestion}>
                  Aprimorar descricao
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!aiSuggestion}
                  onClick={() => setDescriptionDraft(aiSuggestion)}
                >
                  Usar sugestao
                </Button>
              </div>
              {aiSuggestion ? <pre className="task-details__ai-suggestion">{aiSuggestion}</pre> : null}
            </section>

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
                      onClick={() => onToggleChecklistItem(task.id, item.id)}
                    >
                      {item.done ? "x" : "o"}
                    </button>
                    <p>{item.label}</p>
                  </li>
                ))}
              </ul>
            </section>

            {customFields.length > 0 ? (
              <section className="task-details__section">
                <h3>Campos customizados</h3>
                <div className="task-details__custom-fields">
                  {customFields.map(({ definition, value }) => (
                    <div className="task-details__custom-field" key={definition.id}>
                      <span>{definition.label}</span>
                      <strong>{formatCustomFieldValue(value, definition)}</strong>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="task-details__section">
              <h3>Tags</h3>
              <div className="task-details__tags">
                {task.tags.map(tag => (
                  <span key={tag} className="task-details__tag">
                    {tag}
                  </span>
                ))}
              </div>
            </section>
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
                <Textarea
                  className="task-details__chat-input"
                  placeholder="Pergunte algo sobre este card"
                  value={chatInput}
                  onChange={event => setChatInput(event.target.value)}
                />
                <Button type="button" size="sm" onClick={handleSendChat}>
                  Enviar
                </Button>
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
                  <strong>{assignee.name}</strong>
                  <span>Criou esta tarefa</span>
                </li>
              </ul>
            </section>
          </aside>
        </div>
    </ModalShell>
  );
}

