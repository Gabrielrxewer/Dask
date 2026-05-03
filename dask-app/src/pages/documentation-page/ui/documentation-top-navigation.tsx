import { AppIcon, WorkspaceActionButton } from "@/shared/ui";

interface DocumentationTopNavigationProps {
  fromCard: boolean;
  disabled: boolean;
  isAssistantOpen: boolean;
  hasActiveDoc: boolean;
  canDeleteDoc: boolean;
  canSendCommercialDocument: boolean;
  readOnly?: boolean;
  onBack: () => void;
  onCreate: () => void;
  onSendCommercialDocument: () => void;
  onToggleAssistant: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function DocumentationTopNavigation({
  fromCard,
  disabled,
  isAssistantOpen,
  hasActiveDoc,
  canDeleteDoc,
  canSendCommercialDocument,
  readOnly = false,
  onBack,
  onCreate,
  onSendCommercialDocument,
  onToggleAssistant,
  onDuplicate,
  onDelete
}: DocumentationTopNavigationProps) {
  return (
    <section className="docs-top-nav" aria-label="Acoes de documentacao">
      {fromCard || readOnly ? (
        <WorkspaceActionButton
          className="docs-top-nav__btn"
          label="Voltar"
          disabled={disabled}
          onClick={onBack}
          icon={<AppIcon name="arrow-left" />}
        />
      ) : (
        <WorkspaceActionButton
          className="docs-top-nav__btn"
          tone="accent"
          label="Nova doc"
          disabled={disabled}
          onClick={onCreate}
          icon="+"
        />
      )}
      <div className="docs-top-nav__actions">
        {!readOnly && canSendCommercialDocument ? (
          <WorkspaceActionButton
            className="docs-top-nav__btn"
            tone="accent"
            label="Enviar para cliente"
            disabled={disabled}
            onClick={onSendCommercialDocument}
            icon={<AppIcon name="send" />}
          />
        ) : null}
        {!readOnly ? (
          <>
            <WorkspaceActionButton
              className={`docs-top-nav__btn${isAssistantOpen ? " docs-top-nav__btn--active" : ""}`}
              label={isAssistantOpen ? "Ocultar chat" : "Chat IA"}
              disabled={disabled}
              onClick={onToggleAssistant}
              icon={<AppIcon name="message" />}
            />
            <WorkspaceActionButton
              className="docs-top-nav__btn"
              label="Duplicar doc"
              disabled={!hasActiveDoc || disabled}
              onClick={onDuplicate}
              icon={<AppIcon name="copy" />}
            />
            <WorkspaceActionButton
              className="docs-top-nav__btn"
              tone="danger"
              label="Excluir doc"
              disabled={!hasActiveDoc || !canDeleteDoc || disabled}
              onClick={onDelete}
              icon={<AppIcon name="trash" />}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}
