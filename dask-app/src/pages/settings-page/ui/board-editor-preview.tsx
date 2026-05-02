type BoardEditorPreviewProps = {
  isHidden: boolean;
};

export function BoardEditorPreview({ isHidden }: BoardEditorPreviewProps) {
  return (
    <div className={`board-editor__mock-cards${isHidden ? " is-dimmed" : ""}`}>
      <div className="board-editor__mock-card board-editor__mock-card--a" />
      <div className="board-editor__mock-card board-editor__mock-card--b" />
      <div className="board-editor__mock-card board-editor__mock-card--c" />
      <div className="board-editor__mock-card board-editor__mock-card--a" />
      <div className="board-editor__mock-card board-editor__mock-card--b" />
    </div>
  );
}
