import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CreateTaskInput } from "@/modules/workspace";
import { Button, TextInput } from "@/shared/ui";
import "./create-task-button.css";

interface CreateTaskButtonProps {
  onCreate: (input: CreateTaskInput) => void | Promise<void>;
}

const typeOptions: Array<{ id: string; label: string }> = [
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

export function CreateTaskButton({ onCreate }: CreateTaskButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState(typeOptions[0].id);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", onEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      return;
    }

    await onCreate({ type, title, description });

    setIsOpen(false);
    setType(typeOptions[0].id);
    setTitle("");
    setDescription("");
  };

  const modal = (
    <div className="create-item-modal__overlay" role="presentation" onClick={() => setIsOpen(false)}>
      <section
        className="create-item-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-item-title"
        onClick={event => event.stopPropagation()}
      >
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
          <label className="create-item-modal__field">
            <span>Tipo do item</span>
            <select value={type} onChange={event => setType(event.target.value)}>
              {typeOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="create-item-modal__field">
            <span>Titulo</span>
            <TextInput
              className="create-item-modal__input"
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="Ex: Ajustar fluxo de aprovacao"
              autoFocus
            />
          </label>

          <label className="create-item-modal__field">
            <span>Descricao</span>
            <textarea
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder="Descreva contexto, objetivo e resultado esperado"
            />
          </label>

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
      </section>
    </div>
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
