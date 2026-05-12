import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { MarketingTemplate, SendMarketingTemplateTestEmailValues } from "@/modules/marketing";
import { sendMarketingTemplateTestEmailSchema } from "@/modules/marketing";
import { AppDialog, AppForm, AppFormActions, AppTextField, Button } from "@/shared/ui";

interface EmailTemplateTestDialogProps {
  template: MarketingTemplate | null;
  open: boolean;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (templateId: string, values: SendMarketingTemplateTestEmailValues) => Promise<void>;
}

type EmailTemplateTestFormValues = z.input<typeof sendMarketingTemplateTestEmailSchema>;

const TEMPLATE_VARIABLE_PATTERN = /\{\{\s*([^{}\s]+)\s*\}\}/g;

function extractTemplateVariables(template: MarketingTemplate | null): string[] {
  if (!template) {
    return [];
  }

  const source = [template.subject, template.bodyMarkdown, template.bodyHtml ?? ""].join("\n");
  return Array.from(new Set(Array.from(source.matchAll(TEMPLATE_VARIABLE_PATTERN), (match) => match[1])));
}

const buildDefaultValues = (template: MarketingTemplate | null): EmailTemplateTestFormValues => ({
  to: "",
  variables: extractTemplateVariables(template).map((key) => ({ key, value: "" }))
});

export function EmailTemplateTestDialog({
  template,
  open,
  isSubmitting = false,
  onOpenChange,
  onSubmit
}: EmailTemplateTestDialogProps) {
  const form = useForm<EmailTemplateTestFormValues, unknown, SendMarketingTemplateTestEmailValues>({
    resolver: zodResolver(sendMarketingTemplateTestEmailSchema),
    defaultValues: buildDefaultValues(template)
  });

  useEffect(() => {
    if (open) {
      form.reset(buildDefaultValues(template));
    }
  }, [open, form, template]);

  const variableFields = form.watch("variables") ?? [];

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
        {variableFields.map((variable, index) => (
          <div key={`${variable.key}-${index}`}>
            <input type="hidden" {...form.register(`variables.${index}.key` as const)} />
            <AppTextField
              name={`variables.${index}.value` as const}
              label={variable.key}
              placeholder="Valor para o teste"
            />
          </div>
        ))}

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
