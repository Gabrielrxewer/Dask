import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { billingForWorkItemSchema, type BillingForWorkItemInputValues, type BillingForWorkItemValues } from "@/modules/commercial/model";
import { AppDialog, AppForm, AppFormActions, AppTextareaField, Button } from "@/shared/ui";

export function BillingJustificationDialog({
  workItemId,
  workItemTitle,
  isSubmitting,
  onClose,
  onSubmit
}: {
  workItemId: string;
  workItemTitle: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (justification: string) => void;
}) {
  const form = useForm<BillingForWorkItemInputValues, unknown, BillingForWorkItemValues>({
    resolver: zodResolver(billingForWorkItemSchema),
    values: {
      workItemId,
      customerId: "",
      amount: "",
      catalogItemId: "",
      hasProposalOrContract: false,
      justification: ""
    },
    mode: "onBlur"
  });

  return (
    <AppDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Justificativa da cobranca"
      description={`Registrar motivo formal para cobrar "${workItemTitle}" antes de proposta ou contrato.`}
      className="commercial-page__modal"
      contentClassName="commercial-page__modal-content"
      footer={(
        <AppFormActions className="commercial-page__row-actions">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="billing-justification-form" variant="primary" loading={isSubmitting}>
            Gerar cobranca
          </Button>
        </AppFormActions>
      )}
    >
      <AppForm<BillingForWorkItemInputValues, BillingForWorkItemValues>
        id="billing-justification-form"
        form={form}
        disabled={isSubmitting}
        onSubmit={(values) => onSubmit(String(values.justification ?? "").trim())}
        className="commercial-page__modal-form"
      >
        <AppTextareaField
          name="justification"
          label="Justificativa formal"
          rows={4}
          placeholder="Ex.: cobranca de diagnostico aprovada pelo contato antes da proposta formal."
          disabled={isSubmitting}
          autoFocus
        />
      </AppForm>
    </AppDialog>
  );
}
