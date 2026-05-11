import { z } from "zod";

const optionalTemplateText = (max: number) =>
  z.string().trim().max(max).transform((value) => value || undefined).optional();

export const marketingTemplateVariablesSchema = z
  .array(z.string().trim().min(1).max(80))
  .max(80)
  .default([]);

export const marketingTemplateFormSchema = z.object({
  name: z.string().trim().min(2, "Informe ao menos 2 caracteres.").max(160),
  category: optionalTemplateText(80),
  objective: optionalTemplateText(80),
  funnelStage: optionalTemplateText(80),
  subject: z.string().trim().min(1, "Informe o assunto.").max(220),
  bodyMarkdown: z.string().trim().min(1, "Informe o corpo do template.").max(200000),
  bodyHtml: optionalTemplateText(300000),
  variables: marketingTemplateVariablesSchema
});

export const updateMarketingTemplateSchema = marketingTemplateFormSchema.partial().extend({
  isArchived: z.boolean().optional()
}).refine((value) => Object.keys(value).length > 0, {
  message: "Informe ao menos um campo para atualizar."
});

const templateTestVariablesSchema = z
  .string()
  .trim()
  .optional()
  .transform((value, context): Record<string, string | number | boolean | null> | undefined => {
    if (!value) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(value) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe um objeto JSON de variaveis."
        });
        return undefined;
      }

      const entries = Object.entries(parsed as Record<string, unknown>);
      const invalidEntry = entries.find(([, entry]) => (
        entry !== null &&
        typeof entry !== "string" &&
        typeof entry !== "number" &&
        typeof entry !== "boolean"
      ));
      if (invalidEntry) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Variaveis aceitam apenas texto, numero, booleano ou nulo."
        });
        return undefined;
      }

      return parsed as Record<string, string | number | boolean | null>;
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "JSON de variaveis invalido."
      });
      return undefined;
    }
  });

export const sendMarketingTemplateTestEmailSchema = z.object({
  to: z.string().trim().email("Informe um email valido."),
  variables: templateTestVariablesSchema
});

export type MarketingTemplateFormValues = z.infer<typeof marketingTemplateFormSchema>;
export type UpdateMarketingTemplateValues = z.infer<typeof updateMarketingTemplateSchema>;
export type SendMarketingTemplateTestEmailValues = z.output<typeof sendMarketingTemplateTestEmailSchema>;
