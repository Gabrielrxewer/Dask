import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import {
  commercialDocumentSendSchema,
  type CommercialDocumentSendInput
} from "@/modules/documentation";
import type { WorkspaceDocument } from "@/modules/workspace";
import {
  AppCheckboxField,
  AppDateTimeField,
  AppDialog,
  AppForm,
  AppFormActions,
  AppFormField,
  AppFormGrid,
  AppIcon,
  AppTextField,
  AppTextareaField,
  Button
} from "@/shared/ui";
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
  onSend: (input: CommercialDocumentSendInput) => Promise<void>;
}

type CommercialDocumentSendFormValues = z.input<typeof commercialDocumentSendSchema>;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
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
  const [emailDraft, setEmailDraft] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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

  const form = useForm<CommercialDocumentSendFormValues, unknown, CommercialDocumentSendInput>({
    resolver: zodResolver(commercialDocumentSendSchema),
    defaultValues: {
      recipients: readInitialEmails(document, initialEmails),
      subject: document.metadata?.sendSubject as string | undefined,
      message: document.metadata?.sendMessage as string | undefined,
      includeAttachments: true,
      selectedAssetIds: [],
      expirationDate: null,
      requireLogin: true,
      allowAcceptReject: true,
      linkedWorkItemId: typeof document.metadata?.linkedWorkItemId === "string" ? document.metadata.linkedWorkItemId : null,
      resolvedPreviewSnapshot: undefined
    }
  });

  const recipients = form.watch("recipients") ?? [];
  const {
    formState: { errors, isSubmitting }
  } = form;

  useEffect(() => {
    const nextEmails = readInitialEmails(document, initialEmails);
    if (nextEmails.length === 0) {
      return;
    }
    form.setValue("recipients", uniqueEmails([...(form.getValues("recipients") ?? []), ...nextEmails]), {
      shouldValidate: true
    });
  }, [document, form, initialEmails]);

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

    form.setValue("recipients", uniqueEmails([...recipients, ...candidates]), {
      shouldDirty: true,
      shouldValidate: true
    });
    setEmailDraft("");
    return true;
  }

  function removeEmail(emailToRemove: string) {
    form.setValue("recipients", recipients.filter((email) => email !== emailToRemove), {
      shouldDirty: true,
      shouldValidate: true
    });
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

  async function submit(values: CommercialDocumentSendInput) {
    const nextRecipients = uniqueEmails([...values.recipients, ...splitEmailDraft(emailDraft)]);
    const expirationDate = values.expirationDate
      ? new Date(values.expirationDate).toISOString()
      : null;
    const parsed = commercialDocumentSendSchema.parse({
      ...values,
      recipients: nextRecipients,
      expirationDate
    });

    await onSend(parsed);
    form.setValue("recipients", nextRecipients);
    setEmailDraft("");
    setSuccessMessage(
      hasBeenSent
        ? `Documento reenviado para ${nextRecipients.length} destinatario${nextRecipients.length > 1 ? "s" : ""}.`
        : `Documento enviado para ${nextRecipients.length} destinatario${nextRecipients.length > 1 ? "s" : ""}.`
    );
  }

  return (
    <AppDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Enviar documento"
      description="Confirme destinatarios, acesso e anexos antes de gerar o link publico autenticado."
      className="documentation-send-modal app-dialog--form"
    >
      <AppForm<CommercialDocumentSendFormValues, CommercialDocumentSendInput>
        form={form}
        className="documentation-send-modal__form"
        onSubmit={submit}
      >
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

        <AppFormField label="E-mails do cliente" error={errors.recipients?.message}>
          <div className="documentation-send-modal__recipients">
            {recipients.map((email) => (
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
              onBlur={() => addEmailDraft(emailDraft)}
              placeholder={recipients.length > 0 ? "Adicionar outro e-mail" : "cliente@empresa.com"}
              autoFocus
              disabled={isSubmitting}
            />
          </div>
        </AppFormField>

        <AppFormGrid className="documentation-send-modal__grid" columns={2}>
          <AppTextField name="subject" label="Assunto" placeholder={document.title} disabled={isSubmitting} />
          <AppDateTimeField
            name="expirationDate"
            label="Validade do link"
            placeholder="Selecionar data e hora"
            disabled={isSubmitting}
          />
        </AppFormGrid>

        <AppTextareaField name="message" label="Mensagem" rows={3} placeholder="Mensagem opcional para o cliente" disabled={isSubmitting} />

        <div className="documentation-send-modal__options">
          <AppCheckboxField name="includeAttachments" label="Incluir anexos autorizados" disabled={isSubmitting} />
          <AppCheckboxField name="requireLogin" label="Exigir login do cliente" disabled={isSubmitting} />
          <AppCheckboxField name="allowAcceptReject" label="Permitir aceite/recusa" disabled={isSubmitting} />
        </div>

        {successMessage ? <p className="documentation-send-modal__success">{successMessage}</p> : null}
        {errors.root ? <p className="documentation-send-modal__error">{errors.root.message}</p> : null}

        <AppFormActions className="documentation-send-modal__footer">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? "Enviando..." : submitLabel}
          </Button>
        </AppFormActions>
      </AppForm>
    </AppDialog>
  );
}
