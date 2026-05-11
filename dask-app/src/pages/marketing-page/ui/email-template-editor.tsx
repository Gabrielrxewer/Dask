import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { MarketingTemplate, MarketingTemplateFormValues } from "@/modules/marketing";
import { marketingTemplateFormSchema } from "@/modules/marketing";
import {
  AppForm,
  AppFormActions,
  AppFormGrid,
  AppSelectField,
  AppTextField,
  AppTextareaField,
  Button
} from "@/shared/ui";
import { OBJECTIVE_OPTIONS } from "./marketing-page.model";
import { EmailTemplatePreview } from "./email-template-preview";
import { EmailVariablePicker } from "./email-variable-picker";

const TEMPLATE_OBJECTIVE_ITEMS = OBJECTIVE_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label
}));

const DEFAULT_TEMPLATE_VALUES: MarketingTemplateFormValues = {
  name: "",
  category: "newsletter",
  objective: "LEAD_NURTURE",
  funnelStage: "mql",
  subject: "",
  bodyMarkdown: "## Assunto principal\n\nMensagem com contexto operacional.\n\n- ponto 1\n- ponto 2",
  bodyHtml: undefined,
  variables: []
};

type MarketingTemplateFormInputValues = z.input<typeof marketingTemplateFormSchema>;

function templateToFormValues(template?: MarketingTemplate | null): MarketingTemplateFormValues {
  if (!template) {
    return DEFAULT_TEMPLATE_VALUES;
  }

  return {
    name: template.name,
    category: template.category ?? "newsletter",
    objective: template.objective ?? "LEAD_NURTURE",
    funnelStage: template.funnelStage ?? "mql",
    subject: template.subject,
    bodyMarkdown: template.bodyMarkdown,
    bodyHtml: template.bodyHtml ?? undefined,
    variables: []
  };
}

interface EmailTemplateEditorProps {
  template?: MarketingTemplate | null;
  isSubmitting?: boolean;
  submitLabel?: string;
  onSubmit: (values: MarketingTemplateFormValues) => Promise<void> | void;
  onCancel?: () => void;
}

export function EmailTemplateEditor({
  template,
  isSubmitting = false,
  submitLabel = "Salvar template",
  onSubmit,
  onCancel
}: EmailTemplateEditorProps) {
  const defaultValues = useMemo(() => templateToFormValues(template), [template]);
  const form = useForm<MarketingTemplateFormInputValues, unknown, MarketingTemplateFormValues>({
    resolver: zodResolver(marketingTemplateFormSchema),
    defaultValues
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const bodyMarkdown = form.watch("bodyMarkdown");
  const subject = form.watch("subject");
  const bodyHtml = form.watch("bodyHtml");

  const insertVariable = (variable: string) => {
    const separator = bodyMarkdown && !bodyMarkdown.endsWith(" ") && !bodyMarkdown.endsWith("\n") ? " " : "";
    form.setValue("bodyMarkdown", `${bodyMarkdown ?? ""}${separator}${variable}`, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true
    });
  };

  return (
    <AppForm<MarketingTemplateFormInputValues, MarketingTemplateFormValues>
      form={form}
      className="mkt-email-template-editor"
      disabled={isSubmitting}
      onSubmit={onSubmit}
    >
      <div className="mkt-email-template-editor__fields">
        <AppTextField name="name" label="Nome" autoFocus />

        <AppFormGrid className="marketing-page__grid" columns={2}>
          <AppTextField name="category" label="Categoria" />
          <AppTextField name="funnelStage" label="Estagio" />
        </AppFormGrid>

        <AppSelectField
          name="objective"
          label="Objetivo"
          options={TEMPLATE_OBJECTIVE_ITEMS}
          formatValue={(value) => (typeof value === "string" && value.length > 0 ? value : "LEAD_NURTURE")}
        />

        <AppTextField name="subject" label="Assunto" />

        <div className="mkt-email-template-editor__variables">
          <span>Variaveis</span>
          <EmailVariablePicker onPick={insertVariable} />
        </div>

        <AppTextareaField name="bodyMarkdown" label="Corpo markdown" rows={9} />
        <AppTextareaField name="bodyHtml" label="HTML opcional" rows={5} formatValue={(value) => value == null ? "" : String(value)} />

        <AppFormActions className="mkt-email-template-editor__actions">
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancelar
            </Button>
          ) : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : submitLabel}
          </Button>
        </AppFormActions>
      </div>

      <EmailTemplatePreview subject={subject} bodyMarkdown={bodyMarkdown} bodyHtml={bodyHtml} />
    </AppForm>
  );
}
