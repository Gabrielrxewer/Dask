import type { Ref } from "react";
import type { ApiWorkflowState } from "@/modules/workspace/model";
import { AppSelect } from "@/shared/ui";

type BoardColumnFormProps = {
  inputRef?: Ref<HTMLInputElement>;
  name: string;
  stateId: string;
  activeStates: ApiWorkflowState[];
  saving: boolean;
  submitLabel: string;
  savingLabel: string;
  cancelLabel: string;
  placeholder?: string;
  autoFocus?: boolean;
  onNameChange: (value: string) => void;
  onStateIdChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export function BoardColumnForm({
  inputRef,
  name,
  stateId,
  activeStates,
  saving,
  submitLabel,
  savingLabel,
  cancelLabel,
  placeholder,
  autoFocus,
  onNameChange,
  onStateIdChange,
  onSubmit,
  onCancel
}: BoardColumnFormProps) {
  const noStateValue = "__none__";

  return (
    <div className="board-editor__column-edit-form">
      <div className="board-editor__edit-field">
        <label className="board-editor__edit-label">Nome</label>
        <input
          ref={inputRef}
          className="board-editor__edit-input"
          value={name}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onChange={(event) => onNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onSubmit();
            }
            if (event.key === "Escape") {
              onCancel();
            }
          }}
        />
      </div>
      <div className="board-editor__edit-field">
        <label className="board-editor__edit-label">Estado automatico</label>
        <AppSelect
          className="board-editor__edit-select"
          value={stateId || noStateValue}
          onValueChange={(value) => onStateIdChange(value === noStateValue ? "" : value)}
          aria-label="Estado automatico"
          items={[
            { value: noStateValue, label: "Sem estado" },
            ...activeStates.map((state) => ({ value: state.id, label: state.name }))
          ]}
        />
      </div>
      <div className="board-editor__edit-actions">
        <button type="button" className="board-editor__btn-save" onClick={onSubmit} disabled={saving || !name.trim()}>
          {saving ? savingLabel : submitLabel}
        </button>
        <button type="button" className="board-editor__btn-cancel" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
