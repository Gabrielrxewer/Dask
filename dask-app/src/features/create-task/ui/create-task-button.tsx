import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { priorityMeta, taskPriorityOptions, type TaskPriority } from "@/entities/task";
import type { CreateTaskInput } from "@/modules/workspace";
import { Button, FormField, ModalShell, Select, TextInput, Textarea } from "@/shared/ui";
import "./create-task-button.css";

interface CreateTaskButtonProps {
  onCreate: (input: CreateTaskInput) => void | Promise<void>;
  typeOptions?: Array<{ id: string; label: string }>;
}

const fallbackTypeOptions: Array<{ id: string; label: string }> = [
  { id: "task", label: "Task" },
  { id: "bug", label: "Bug" },
  { id: "user-story", label: "User Story" },
  { id: "epic", label: "Epic" }
];

function improveDescriptionMock(description: string): string {
  const base = description.trim();
  if (!base) {
    return [
      "Objetivo:",
      "Definir claramente o resultado esperado desta entrega.",
      "",
      "Criterios de aceite:",
      "- Fluxo principal validado",
      "- Sem bloqueios conhecidos",
      "- Comunicacao alinhada com o time"
    ].join("\n");
  }

  return [
    "Contexto:",
    base,
    "",
    "Refinamento sugerido:",
    "- Escopo principal explicitado",
    "- Dependencias mapeadas",
    "- Proximo passo definido"
  ].join("\n");
}

export function CreateTaskButton({ onCreate, typeOptions }: CreateTaskButtonProps) {
  const resolvedTypeOptions =
    typeOptions && typeOptions.length > 0 ? typeOptions : fallbackTypeOptions;
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState(resolvedTypeOptions[0].id);
  const [priority, setPriority] = useState<TaskPriority>(2);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!resolvedTypeOptions.some(option => option.id === type)) {
      setType(resolvedTypeOptions[0].id);
    }
  }, [resolvedTypeOptions, type]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      return;
    }

    await onCreate({ type, title, description, priority });

    setIsOpen(false);
    setType(resolvedTypeOptions[0].id);
    setPriority(2);
    setTitle("");
    setDescription("");
  };

  const modal = (
    <ModalShell titleId="create-item-title" className="create-item-modal" onClose={() => setIsOpen(false)}>
        <header className="create-item-modal__header">
          <div>
            <p className="create-item-modal__label">Novo item</p>
            <h2 id="create-item-title">Criar tarefa</h2>
          </div>
          <button
            type="button"
            className="create-item-modal__close"
            onClick={() => setIsOpen(false)}
            aria-label="Fechar modal"
          >
            x
          </button>
        </header>

        <div className="create-item-modal__body">
          <FormField label="Tipo do item" className="create-item-modal__field">
            <Select value={type} onChange={event => setType(event.target.value)}>
              {resolvedTypeOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Titulo" className="create-item-modal__field">
            <TextInput
              className="create-item-modal__input"
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="Ex: Ajustar fluxo de aprovacao"
              autoFocus
            />
          </FormField>

          <FormField label="Prioridade" className="create-item-modal__field">
            <Select
              value={String(priority)}
              onChange={event => setPriority(Number(event.target.value) as TaskPriority)}
            >
              {taskPriorityOptions.map(option => (
                <option value={option} key={option}>
                  {priorityMeta[option].label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Descricao" className="create-item-modal__field">
            <Textarea
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder="Descreva contexto, objetivo e resultado esperado"
            />
          </FormField>

          <button
            type="button"
            className="create-item-modal__ai"
            onClick={() => setDescription(prev => improveDescriptionMock(prev))}
          >
            Aprimorar descricao com IA
          </button>
        </div>

        <footer className="create-item-modal__footer">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void handleSubmit()} disabled={!title.trim()}>
            Criar item
          </Button>
        </footer>
    </ModalShell>
  );

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        + Nova tarefa
      </Button>
      {isOpen ? createPortal(modal, document.body) : null}
    </>
  );
}

