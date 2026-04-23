import { useState, type CSSProperties } from "react";
import type { BoardConfig, TaskStatusId, TaskStatus } from "@/entities/task";
import type { MembersById } from "@/entities/member";
import type { CreateTaskInput } from "@/modules/workspace";
import { TaskTypeIcon, resolveTaskTypeIconName } from "@/entities/task/ui/task-type-icon";
import { cn } from "@/shared/lib/cn";
import { Button, ModalShell } from "@/shared/ui";
import { TaskDetailsModal } from "@/widgets/task-details";
import "./create-task-button.css";

interface TaskTypeOption {
  id: string;
  label: string;
  background?: string;
  border?: string;
  text?: string;
}

interface CreateTaskButtonProps {
  onCreate: (input: CreateTaskInput) => void | Promise<void>;
  initialStatusId: TaskStatusId;
  statuses: TaskStatus[];
  boardConfig: BoardConfig;
  membersById: MembersById;
  taskTypes: TaskTypeOption[];
  availableTags?: Array<{ id: string; name: string; color: string }>;
  className?: string;
}

interface TaskTypePickerDialogProps {
  taskTypes: TaskTypeOption[];
  onClose: () => void;
  onSelect: (taskTypeId: string) => void;
}

const TASK_TYPE_PICKER_DESCRIPTION: Record<string, string> = {
  bug: "Abra um fluxo voltado para impacto, reproducao e prioridade da correcao.",
  "user-story": "Estruture objetivo, contexto e criterios de aceite logo na abertura.",
  task: "Crie uma tarefa enxuta para tirar uma entrega operacional do papel rapido.",
  improvement: "Documente ajustes e melhorias mantendo o board mais claro e rastreavel.",
  epic: "Inicie uma frente mais estrategica para consolidar desdobramentos relacionados.",
  spike: "Registre hipoteses, riscos e descobertas antes de partir para a implementacao.",
  incident: "Priorize impacto, contingencia e andamento de uma ocorrencia no mesmo fluxo.",
  hotfix: "Abra um item mais objetivo para correcao imediata em producao.",
  chore: "Organize rotinas tecnicas, ajustes de base e debitos operacionais.",
  research: "Centralize pesquisa, referencias e proximos passos antes da execucao."
};

function getTaskTypePickerDescription(taskType: TaskTypeOption) {
  return TASK_TYPE_PICKER_DESCRIPTION[taskType.id] ?? `Abra o formulario configurado para ${taskType.label.toLowerCase()}.`;
}

function formatTaskTypeCountLabel(count: number) {
  return count === 1 ? "1 tipo ativo" : `${count} tipos ativos`;
}

function TaskTypePickerDialog({ taskTypes, onClose, onSelect }: TaskTypePickerDialogProps) {
  const typeCountLabel = formatTaskTypeCountLabel(taskTypes.length);

  return (
    <ModalShell titleId="create-work-item-type-title" className="create-task-type-modal" onClose={onClose}>
      <div className="create-task-type-modal__surface">
        <header className="create-task-type-modal__header">
          <div className="create-task-type-modal__header-main">
            <div className="create-task-type-modal__badge-row">
              <span className="create-task-type-modal__badge">Novo work item</span>
              <span className="create-task-type-modal__badge create-task-type-modal__badge--accent">
                {typeCountLabel}
              </span>
            </div>

            <div className="create-task-type-modal__header-copy">
              <p className="create-task-type-modal__eyebrow">Criacao guiada</p>
              <h2 id="create-work-item-type-title">Escolha o tipo</h2>
              <p className="create-task-type-modal__description">
                Escolha o fluxo ideal para abrir um formulario ja ajustado ao contexto certo.
              </p>
            </div>
          </div>

          <button className="create-task-type-modal__close" type="button" onClick={onClose} aria-label="Fechar seletor">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" width="16" height="16">
              <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div
          className="create-task-type-modal__grid"
          style={{ "--create-task-type-count": Math.max(taskTypes.length, 1) } as CSSProperties}
        >
          {taskTypes.map(taskType => {
            const description = getTaskTypePickerDescription(taskType);

            return (
              <button
                key={taskType.id}
                type="button"
                className="create-task-type-modal__option"
                style={{
                  "--create-task-type-bg": taskType.background ?? "#e7f3ff",
                  "--create-task-type-border": taskType.border ?? "#c8e3ff",
                  "--create-task-type-text": taskType.text ?? "#0f3d4a"
                } as CSSProperties}
                onClick={() => onSelect(taskType.id)}
              >
                <div className="create-task-type-modal__option-top">
                  <span className="create-task-type-modal__option-icon-shell" aria-hidden="true">
                    <span className="create-task-type-modal__option-icon">
                      <TaskTypeIcon name={resolveTaskTypeIconName(taskType.id)} />
                    </span>
                  </span>

                  <span className="create-task-type-modal__option-copy">
                    <strong className="create-task-type-modal__option-label">{taskType.label}</strong>
                  </span>

                  <span className="create-task-type-modal__option-chevron" aria-hidden="true">
                    <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                      <path
                        d="M7 5l5 5-5 5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>

                <p className="create-task-type-modal__option-description">{description}</p>

                <span className="create-task-type-modal__option-pill">Abrir formulario dedicado</span>
              </button>
            );
          })}
        </div>

        <footer className="create-task-type-modal__footer">
          <p className="create-task-type-modal__footer-note">
            Depois voce pode ajustar tipos e campos nas configuracoes do workspace.
          </p>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </footer>
      </div>
    </ModalShell>
  );
}

export function CreateTaskButton({
  onCreate,
  initialStatusId,
  statuses,
  boardConfig,
  membersById,
  taskTypes,
  availableTags = [],
  className
}: CreateTaskButtonProps) {
  const [isTypePickerOpen, setIsTypePickerOpen] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);

  const handleRequestCreate = () => {
    if (taskTypes.length <= 1) {
      setSelectedTypeId(taskTypes[0]?.id ?? boardConfig.taskTypes[0]?.id ?? "task");
      return;
    }

    setIsTypePickerOpen(true);
  };

  return (
    <>
      <Button className={cn("create-task-button", className)} variant="primary" onClick={handleRequestCreate}>
        + Nova tarefa
      </Button>
      {isTypePickerOpen ? (
        <TaskTypePickerDialog
          taskTypes={taskTypes}
          onClose={() => setIsTypePickerOpen(false)}
          onSelect={taskTypeId => {
            setSelectedTypeId(taskTypeId);
            setIsTypePickerOpen(false);
          }}
        />
      ) : null}
      {selectedTypeId ? (
        <TaskDetailsModal
          mode="create"
          statuses={statuses}
          initialStatusId={initialStatusId}
          initialTypeId={selectedTypeId}
          membersById={membersById}
          boardConfig={boardConfig}
          availableTags={availableTags}
          onCreateTask={onCreate}
          onClose={() => setSelectedTypeId(null)}
        />
      ) : null}
    </>
  );
}
