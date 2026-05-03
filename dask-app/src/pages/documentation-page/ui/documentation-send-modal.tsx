import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import type { WorkspaceDocument } from "@/modules/workspace";
import { AppIcon, Button, FormField, FormModal } from "@/shared/ui";
import {
  DOCUMENT_KIND_LABELS,
  formatRelativeDate,
  getCommercialDocumentStatus,
  hasCommercialDocumentBeenSent,
  normalizeDocumentKind
} from "./documentation-page.local";

interface DocumentationSendModalProps {
  document: WorkspaceDocument;
  initialEmails?: string[];
  onClose: () => void;
  onSend: (emails: string[]) => Promise<void>;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function uniqueEmails(values: string[]): string[] {
  return Array.from(new Set(values.map(normalizeEmail).filter(Boolean)));
}

function readInitialEmails(document: WorkspaceDocument, initialEmails: string[] = []): string[] {
  const metadata = document.metadata ?? {};
  return uniqueEmails([
    ...(Array.isArray(metadata.sentToEmails) ? metadata.sentToEmails.filter((value): value is string => typeof value === "string") : []),
    typeof metadata.sentToEmail === "string" ? metadata.sentToEmail : "",
    typeof metadata.clientEmail === "string" ? metadata.clientEmail : "",
    ...initialEmails
  ]);
}

function splitEmailDraft(value: string): string[] {
  return value
    .split(/[,\s;]+/)
    .map(normalizeEmail)
    .filter(Boolean);
}

export function DocumentationSendModal({ document, initialEmails = [], onClose, onSend }: DocumentationSendModalProps) {
  const [emails, setEmails] = useState(() => readInitialEmails(document, initialEmails));
  const [emailDraft, setEmailDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const documentKind = normalizeDocumentKind(document.kind);
  const status = getCommercialDocumentStatus(document);
  const hasBeenSent = hasCommercialDocumentBeenSent(document);
  const sentAt = typeof document.metadata?.sentAt === "string" ? document.metadata.sentAt : "";
  const sentToEmails = Array.isArray(document.metadata?.sentToEmails)
    ? document.metadata.sentToEmails.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : typeof document.metadata?.sentToEmail === "string" && document.metadata.sentToEmail.trim()
      ? [document.metadata.sentToEmail]
      : [];
  const submitLabel = hasBeenSent ? "Reenviar" : "Enviar para cliente";

  useEffect(() => {
    const nextEmails = readInitialEmails(document, initialEmails);
    if (nextEmails.length === 0) {
      return;
    }

    setEmails((current) => uniqueEmails([...current, ...nextEmails]));
  }, [document, initialEmails]);

  const sentInfo = useMemo(
    () => [
      sentAt ? { label: "Data de envio", value: formatRelativeDate(sentAt) } : null,
      sentToEmails.length > 0 ? { label: "Destinatarios", value: sentToEmails.join(", ") } : null
    ].filter((item): item is { label: string; value: string } => Boolean(item)),
    [sentAt, sentToEmails]
  );

  function addEmailDraft(value: string): boolean {
    const candidates = splitEmailDraft(value);

    if (candidates.length === 0) {
      return false;
    }

    const invalidEmail = candidates.find((candidate) => !isValidEmail(candidate));
    if (invalidEmail) {
      setErrorMessage(`E-mail invalido: ${invalidEmail}`);
      return false;
    }

    setEmails((current) => uniqueEmails([...current, ...candidates]));
    setEmailDraft("");
    setErrorMessage(null);
    return true;
  }

  function removeEmail(emailToRemove: string) {
    setEmails((current) => current.filter((email) => email !== emailToRemove));
  }

  function handleEmailKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" && event.key !== "," && event.key !== "Tab") {
      return;
    }

    if (!emailDraft.trim()) {
      return;
    }

    event.preventDefault();
    addEmailDraft(emailDraft);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const nextEmails = uniqueEmails([...emails, ...splitEmailDraft(emailDraft)]);
    const invalidEmail = nextEmails.find((candidate) => !isValidEmail(candidate));
    if (invalidEmail) {
      setErrorMessage(`E-mail invalido: ${invalidEmail}`);
      return;
    }

    if (nextEmails.length === 0) {
      setErrorMessage("Informe ao menos um e-mail do cliente.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await onSend(nextEmails);
      setEmails(nextEmails);
      setEmailDraft("");
      setSuccessMessage(
        hasBeenSent
          ? `Documento reenviado para ${nextEmails.length} destinatario${nextEmails.length > 1 ? "s" : ""}.`
          : `Documento enviado para ${nextEmails.length} destinatario${nextEmails.length > 1 ? "s" : ""}.`
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Falha ao enviar documento.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormModal
      titleId="documentation-send-modal-title"
      title="Enviar documento"
      subtitle="Confirme o destinatario antes de gerar o link publico."
      className="documentation-send-modal"
      headerClassName="documentation-create-modal__header"
      closeButtonClassName="documentation-create-modal__close"
      footer={null}
      onClose={onClose}
    >
      <form className="documentation-send-modal__form" onSubmit={handleSubmit}>
        <section className="documentation-send-modal__summary" aria-label="Resumo do envio">
          <span className="documentation-send-modal__icon">
            <AppIcon name="send" size={18} />
          </span>
          <div>
            <span>Tipo do documento</span>
            <strong>{DOCUMENT_KIND_LABELS[documentKind]}</strong>
          </div>
          <div>
            <span>Status atual</span>
            <strong>{status}</strong>
          </div>
        </section>

        {sentInfo.length > 0 ? (
          <dl className="documentation-send-modal__sent-info">
            {sentInfo.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <FormField label="E-mails do cliente">
          <div className="documentation-send-modal__recipients">
            {emails.map((email) => (
              <span className="documentation-send-modal__recipient-chip" key={email}>
                {email}
                <button
                  type="button"
                  onClick={() => removeEmail(email)}
                  aria-label={`Remover ${email}`}
                  disabled={isSubmitting}
                >
                  x
                </button>
              </span>
            ))}
            <input
              type="email"
              value={emailDraft}
              onChange={(event) => setEmailDraft(event.target.value)}
              onKeyDown={handleEmailKeyDown}
              placeholder={emails.length > 0 ? "Adicionar outro e-mail" : "cliente@empresa.com"}
              autoFocus
              disabled={isSubmitting}
            />
          </div>
        </FormField>

        {successMessage ? <p className="documentation-send-modal__success">{successMessage}</p> : null}
        {errorMessage ? <p className="documentation-send-modal__error">{errorMessage}</p> : null}

        <footer className="documentation-send-modal__footer">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? "Enviando..." : submitLabel}
          </Button>
        </footer>
      </form>
    </FormModal>
  );
}
