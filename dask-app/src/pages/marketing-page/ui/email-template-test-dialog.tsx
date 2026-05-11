import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { MarketingTemplate, SendMarketingTemplateTestEmailValues } from "@/modules/marketing";
import { sendMarketingTemplateTestEmailSchema } from "@/modules/marketing";
import { AppDialog, AppForm, AppFormActions, AppTextField, AppTextareaField, Button } from "@/shared/ui";

interface EmailTemplateTestDialogProps {
  template: MarketingTemplate | null;
  open: boolean;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (templateId: string, values: SendMarketingTemplateTestEmailValues) => Promise<void>;
}

type EmailTemplateTestFormValues = z.input<typeof sendMarketingTemplateTestEmailSchema>;

const DEFAULT_VALUES: EmailTemplateTestFormValues = {
  to: "",
  variables: "{\n  \"lead.firstName\": \"Ana\",\n  \"companyName\": \"Dask\"\n}"
};

export function EmailTemplateTestDialog({
  template,
  open,
  isSubmitting = false,
  onOpenChange,
  onSubmit
}: EmailTemplateTestDialogProps) {
  const form = useForm<EmailTemplateTestFormValues, unknown, SendMarketingTemplateTestEmailValues>({
    resolver: zodResolver(sendMarketingTemplateTestEmailSchema),
    defaultValues: DEFAULT_VALUES
  });

  useEffect(() => {
    if (open) {
      form.reset(DEFAULT_VALUES);
    }
  }, [open, form]);

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Enviar teste"
      description={template?.name ?? "Template"}
      contentClassName="mkt-template-dialog"
    >
      <AppForm<EmailTemplateTestFormValues, SendMarketingTemplateTestEmailValues>
        form={form}
        className="mkt-follow-up-dialog__form"
        disabled={isSubmitting}
        onSubmit={async (values) => {
          if (!template) {
            return;
          }
          await onSubmit(template.id, values);
          onOpenChange(false);
        }}
      >
        <AppTextField name="to" label="E-mail de destino" type="email" placeholder="ana@empresa.com" autoFocus />
        <AppTextareaField name="variables" label="Variaveis JSON" rows={6} />

        <AppFormActions className="mkt-follow-up-dialog__actions">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || !template}>
            {isSubmitting ? "Enviando..." : "Enviar teste"}
          </Button>
        </AppFormActions>
      </AppForm>
    </AppDialog>
  );
}
