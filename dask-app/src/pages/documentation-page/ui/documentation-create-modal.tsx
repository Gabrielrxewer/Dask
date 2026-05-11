import type { DocumentKind } from "@/modules/workspace";
import { AppDialog } from "@/shared/ui";
import {
  DOCUMENT_KIND_DESCRIPTIONS,
  DOCUMENT_KIND_LABELS,
  DOCUMENT_KIND_OPTIONS,
  renderDocumentKindIcon
} from "./documentation-page.local";

interface DocumentationCreateModalProps {
  onClose: () => void;
  onCreate: (kind: DocumentKind) => void | Promise<void>;
}

export function DocumentationCreateModal({ onClose, onCreate }: DocumentationCreateModalProps) {
  return (
    <AppDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Novo documento"
      description="Escolha o tipo de documento que deseja criar."
      className="documentation-create-modal"
    >
      <div className="documentation-create-modal__grid">
        {DOCUMENT_KIND_OPTIONS.map((kind) => (
          <button
            key={kind}
            type="button"
            className={`documentation-create-modal__option documentation-create-modal__option--${kind}`}
            onClick={() => void onCreate(kind)}
          >
            <span className="documentation-create-modal__icon">{renderDocumentKindIcon(kind)}</span>
            <strong>{DOCUMENT_KIND_LABELS[kind]}</strong>
            <span>{DOCUMENT_KIND_DESCRIPTIONS[kind]}</span>
            <em>Template inicial incluido</em>
          </button>
        ))}
      </div>
    </AppDialog>
  );
}
