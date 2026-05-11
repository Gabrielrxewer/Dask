import type { Ref } from "react";
import { AppSelect } from "@/shared/ui";
import { IconTemplate } from "./board-editor-icons";
import type { BoardPerspective, PerspectiveTemplateSeed } from "./board-editor-settings.model";

type BoardTemplateToolbarProps = {
  activePerspective: BoardPerspective | null;
  templateSeeds: PerspectiveTemplateSeed[];
  selectedApplyTemplateKey: string;
  selectedApplyTemplateSeed: PerspectiveTemplateSeed | null;
  loadingTemplates: boolean;
  creatingTemplateMode: boolean;
  templateInputRef: Ref<HTMLInputElement>;
  newTemplateName: string;
  newTemplateDescription: string;
  templateFeedback: string;
  templateError: string;
  onSelectedApplyTemplateKeyChange: (value: string) => void;
  onApplyTemplateToActivePerspective: () => void;
  onNewTemplateNameChange: (value: string) => void;
  onNewTemplateDescriptionChange: (value: string) => void;
  onSavePerspectiveAsTemplate: () => void;
  onStartCreatingTemplate: () => void;
  onCancelCreatingTemplate: () => void;
};

export function BoardTemplateToolbar({
  activePerspective,
  templateSeeds,
  selectedApplyTemplateKey,
  selectedApplyTemplateSeed,
  loadingTemplates,
  creatingTemplateMode,
  templateInputRef,
  newTemplateName,
  newTemplateDescription,
  templateFeedback,
  templateError,
  onSelectedApplyTemplateKeyChange,
  onApplyTemplateToActivePerspective,
  onNewTemplateNameChange,
  onNewTemplateDescriptionChange,
  onSavePerspectiveAsTemplate,
  onStartCreatingTemplate,
  onCancelCreatingTemplate
}: BoardTemplateToolbarProps) {
  const noTemplateValue = "__none__";

  return (
    <div className="board-editor__template-toolbar">
      <div className="board-editor__template-group">
        <div className="board-editor__template-group-copy">
          <strong>Template por perspectiva</strong>
          <span>
            {activePerspective?.template
              ? `Base atual: ${activePerspective.template.templateName} / ${activePerspective.template.perspectiveName}`
              : "Aplique um template salvo na perspectiva ativa."}
          </span>
        </div>
        <div className="board-editor__template-actions">
          <AppSelect
            className="board-editor__template-select"
            value={selectedApplyTemplateKey || noTemplateValue}
            onValueChange={(value) => onSelectedApplyTemplateKeyChange(value === noTemplateValue ? "" : value)}
            disabled={loadingTemplates || templateSeeds.length === 0}
            aria-label="Template por perspectiva"
            placeholder={loadingTemplates ? "Carregando templates..." : templateSeeds.length === 0 ? "Sem templates salvos" : "Selecionar template"}
            items={[
              { value: noTemplateValue, label: "Selecionar template" },
              ...templateSeeds.map((seed) => ({
                value: seed.key,
                label: `${seed.templateName} / ${seed.perspectiveName}`
              }))
            ]}
          />
          <button
            type="button"
            className="board-editor__btn-discard"
            onClick={onApplyTemplateToActivePerspective}
            disabled={!activePerspective || !selectedApplyTemplateSeed}
          >
            Aplicar template
          </button>
        </div>
      </div>

      <div className="board-editor__template-group board-editor__template-group--save">
        {creatingTemplateMode ? (
          <div className="board-editor__template-create">
            <input
              ref={templateInputRef}
              className="board-editor__template-input"
              value={newTemplateName}
              placeholder="Nome do template"
              onChange={(event) => onNewTemplateNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onSavePerspectiveAsTemplate();
                }
                if (event.key === "Escape") {
                  onCancelCreatingTemplate();
                }
              }}
            />
            <input
              className="board-editor__template-input board-editor__template-input--secondary"
              value={newTemplateDescription}
              placeholder="Descricao opcional"
              onChange={(event) => onNewTemplateDescriptionChange(event.target.value)}
            />
            <button type="button" className="board-editor__btn-save-main board-editor__btn-save-main--compact" onClick={onSavePerspectiveAsTemplate}>
              Salvar template
            </button>
            <button type="button" className="board-editor__btn-cancel" onClick={onCancelCreatingTemplate}>
              Cancelar
            </button>
          </div>
        ) : (
          <button type="button" className="board-editor__template-save-btn" onClick={onStartCreatingTemplate} disabled={!activePerspective}>
            <IconTemplate />
            Salvar perspectiva como template
          </button>
        )}
        {templateFeedback ? <span className="board-editor__template-feedback">{templateFeedback}</span> : null}
        {templateError ? <span className="board-editor__template-error">{templateError}</span> : null}
      </div>
    </div>
  );
}
