import type { Ref } from "react";
import type { ApiWorkflowState } from "@/modules/workspace/model";

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
        <select className="board-editor__edit-select" value={stateId} onChange={(event) => onStateIdChange(event.target.value)}>
          <option value="">Sem estado</option>
          {activeStates.map((state) => (
            <option key={state.id} value={state.id}>
              {state.name}
            </option>
          ))}
        </select>
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
