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

function TaskTypePickerDialog({ taskTypes, onClose, onSelect }: TaskTypePickerDialogProps) {
  return (
    <ModalShell titleId="create-work-item-type-title" className="create-task-type-modal" onClose={onClose}>
      <div className="create-task-type-modal__surface">
        <header className="create-task-type-modal__header">
          <div>
            <p className="create-task-type-modal__eyebrow">Novo work item</p>
            <h2 id="create-work-item-type-title">Escolha o tipo</h2>
            <p className="create-task-type-modal__description">
              Selecione o tipo de work item para abrir direto o formulario certo.
            </p>
          </div>
          <button className="create-task-type-modal__close" type="button" onClick={onClose} aria-label="Fechar seletor">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" width="16" height="16">
              <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="create-task-type-modal__grid">
          {taskTypes.map(taskType => (
            <button
              key={taskType.id}
              type="button"
              className="create-task-type-modal__option"
              style={{
                "--create-task-type-bg": taskType.background ?? "rgba(14, 116, 144, 0.08)",
                "--create-task-type-border": taskType.border ?? "rgba(14, 116, 144, 0.22)",
                "--create-task-type-text": taskType.text ?? "#0f3d4a"
              } as CSSProperties}
              onClick={() => onSelect(taskType.id)}
            >
              <span className="create-task-type-modal__option-badge">
                <span className="create-task-type-modal__option-icon" aria-hidden="true">
                  <TaskTypeIcon name={resolveTaskTypeIconName(taskType.id)} />
                </span>
                {taskType.label}
              </span>
            </button>
          ))}
        </div>

        <footer className="create-task-type-modal__footer">
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
