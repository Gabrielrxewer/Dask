import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { billingForLeadSchema, type BillingForLeadInputValues, type BillingForLeadValues } from "@/modules/leads/model";
import { AppDialog, AppForm, AppFormActions, AppTextareaField, Button } from "@/shared/ui";

export function BillingJustificationDialog({
  leadId,
  leadTitle,
  isSubmitting,
  onClose,
  onSubmit
}: {
  leadId: string;
  leadTitle: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (justification: string) => void;
}) {
  const form = useForm<BillingForLeadInputValues, unknown, BillingForLeadValues>({
    resolver: zodResolver(billingForLeadSchema),
    values: {
      leadId,
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
      description={`Registrar motivo formal para cobrar "${leadTitle}" antes de proposta ou contrato.`}
      className="leads-page__modal"
      contentClassName="leads-page__modal-content"
      footer={(
        <AppFormActions className="leads-page__row-actions">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="billing-justification-form" variant="primary" loading={isSubmitting}>
            Gerar cobranca
          </Button>
        </AppFormActions>
      )}
    >
      <AppForm<BillingForLeadInputValues, BillingForLeadValues>
        id="billing-justification-form"
        form={form}
        disabled={isSubmitting}
        onSubmit={(values) => onSubmit(String(values.justification ?? "").trim())}
        className="leads-page__modal-form"
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
