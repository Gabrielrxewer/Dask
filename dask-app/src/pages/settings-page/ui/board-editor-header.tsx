import type { Ref } from "react";
import { AppSelect } from "@/shared/ui";
import { BoardEditorActions } from "./board-editor-actions";
import type { BoardPerspective, PerspectiveTemplateSeed } from "./board-editor-settings.model";

type BoardEditorHeaderProps = {
  perspectives: BoardPerspective[];
  activePerspectiveId: string;
  creatingPerspective: boolean;
  newPerspectiveName: string;
  newPerspectiveTemplateKey: string;
  selectedCreateTemplateSeed: PerspectiveTemplateSeed | null;
  templateSeeds: PerspectiveTemplateSeed[];
  perspectiveInputRef: Ref<HTMLInputElement>;
  hasUnsavedChanges: boolean;
  saving: boolean;
  onSelectPerspective: (perspectiveId: string) => void;
  onDeletePerspective: (perspectiveId: string) => void;
  onCreatePerspective: () => void;
  onStartCreatingPerspective: () => void;
  onCancelCreatingPerspective: () => void;
  onNewPerspectiveNameChange: (value: string) => void;
  onNewPerspectiveTemplateKeyChange: (value: string) => void;
  onDiscard: () => void;
  onSave: () => void;
};

export function BoardEditorHeader({
  perspectives,
  activePerspectiveId,
  creatingPerspective,
  newPerspectiveName,
  newPerspectiveTemplateKey,
  selectedCreateTemplateSeed,
  templateSeeds,
  perspectiveInputRef,
  hasUnsavedChanges,
  saving,
  onSelectPerspective,
  onDeletePerspective,
  onCreatePerspective,
  onStartCreatingPerspective,
  onCancelCreatingPerspective,
  onNewPerspectiveNameChange,
  onNewPerspectiveTemplateKeyChange,
  onDiscard,
  onSave
}: BoardEditorHeaderProps) {
  const noTemplateValue = "__none__";

  return (
    <div className="board-editor__topbar">
      <div className="board-editor__tabs">
        {perspectives.map((perspective) => (
          <div key={perspective.id} className={`board-editor__tab${perspective.id === activePerspectiveId ? " is-active" : ""}`}>
            <button
              type="button"
              className="board-editor__tab-btn"
              onClick={(event) => {
                event.stopPropagation();
                onSelectPerspective(perspective.id);
              }}
            >
              <i style={{ background: perspective.statuses[0]?.dot ?? "var(--brand-blue)" }} />
              {perspective.label}
            </button>
            {perspectives.length > 1 && (
              <button
                type="button"
                className="board-editor__tab-remove"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeletePerspective(perspective.id);
                }}
              >
                x
              </button>
            )}
          </div>
        ))}

        {creatingPerspective ? (
          <div className="board-editor__tab-create board-editor__tab-create--extended" onClick={(event) => event.stopPropagation()}>
            <input
              ref={perspectiveInputRef}
              className="board-editor__tab-input"
              value={newPerspectiveName}
              placeholder={selectedCreateTemplateSeed ? selectedCreateTemplateSeed.perspectiveName : "Nome..."}
              onChange={(event) => onNewPerspectiveNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onCreatePerspective();
                }
                if (event.key === "Escape") {
                  onCancelCreatingPerspective();
                }
              }}
            />
            <AppSelect
              className="board-editor__tab-template-select"
              value={newPerspectiveTemplateKey || noTemplateValue}
              onValueChange={(value) => onNewPerspectiveTemplateKeyChange(value === noTemplateValue ? "" : value)}
              aria-label="Template da perspectiva"
              items={[
                { value: noTemplateValue, label: "Sem template" },
                ...templateSeeds.map((seed) => ({
                  value: seed.key,
                  label: `${seed.templateName} / ${seed.perspectiveName}`
                }))
              ]}
            />
            <button type="button" className="board-editor__tab-confirm" onClick={onCreatePerspective}>
              Criar
            </button>
            <button type="button" className="board-editor__tab-cancel" onClick={onCancelCreatingPerspective}>
              x
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="board-editor__add-perspective"
            onClick={(event) => {
              event.stopPropagation();
              onStartCreatingPerspective();
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Perspectiva
          </button>
        )}
      </div>

      <BoardEditorActions hasUnsavedChanges={hasUnsavedChanges} saving={saving} onDiscard={onDiscard} onSave={onSave} />
    </div>
  );
}
