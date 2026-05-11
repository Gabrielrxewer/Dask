import { Button } from "@/shared/ui";

interface DocumentDecisionBlockProps {
  positiveLabel: string;
  description?: string;
  isSubmitting: boolean;
  error?: string | null;
  success?: boolean;
  onAccept: () => void;
  onReject: () => void;
}

export function DocumentDecisionBlock({
  positiveLabel,
  description = "Seu aceite fica registrado no historico deste documento.",
  isSubmitting,
  error,
  success,
  onAccept,
  onReject
}: DocumentDecisionBlockProps) {
  return (
    <section className="documentation-page__client-decision" aria-label="Decisao do cliente">
      <div>
        <strong>Revise o documento completo antes de continuar.</strong>
        <p>{description}</p>
      </div>
      {error ? <p className="documentation-page__client-decision-error" role="alert">{error}</p> : null}
      {success ? (
        <p className="documentation-page__client-decision-success" role="status" aria-live="polite">
          Decisao registrada com sucesso.
        </p>
      ) : (
        <div className="documentation-page__client-decision-actions">
          <Button type="button" variant="primary" disabled={isSubmitting} onClick={onAccept}>
            {isSubmitting ? "Registrando..." : positiveLabel}
          </Button>
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onReject}>
            Recusar
          </Button>
        </div>
      )}
    </section>
  );
}
