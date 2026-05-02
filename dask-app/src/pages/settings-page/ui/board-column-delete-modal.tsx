type BoardColumnDeleteModalProps = {
  columnName: string;
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function BoardColumnDeleteModal({ columnName, saving, onConfirm, onCancel }: BoardColumnDeleteModalProps) {
  return (
    <div className="board-editor__confirm-overlay" onClick={(event) => event.stopPropagation()}>
      <p>
        Remover <strong>{columnName}</strong>?
      </p>
      <div className="board-editor__confirm-actions">
        <button type="button" className="board-editor__btn-confirm-delete" onClick={onConfirm} disabled={saving}>
          {saving ? "Removendo..." : "Sim, remover"}
        </button>
        <button
          type="button"
          className="board-editor__btn-cancel"
          onClick={(event) => {
            event.stopPropagation();
            onCancel();
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
