type BoardEditorActionsProps = {
  hasUnsavedChanges: boolean;
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
};

export function BoardEditorActions({ hasUnsavedChanges, saving, onDiscard, onSave }: BoardEditorActionsProps) {
  return (
    <div className={`board-editor__save-area${hasUnsavedChanges ? " has-changes" : ""}`}>
      {hasUnsavedChanges && (
        <>
          <span className="board-editor__unsaved-label">
            <span className="board-editor__unsaved-dot" />
            Nao salvo
          </span>
          <button
            type="button"
            className="board-editor__btn-discard"
            onClick={(event) => {
              event.stopPropagation();
              onDiscard();
            }}
            disabled={saving}
          >
            Descartar
          </button>
        </>
      )}
      <button
        type="button"
        className="board-editor__btn-save-main"
        onClick={(event) => {
          event.stopPropagation();
          onSave();
        }}
        disabled={!hasUnsavedChanges || saving}
      >
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}
