import { z } from "zod";

export const marketingSegmentRuleSchema = z.object({
  field: z.string().trim().min(1).max(80),
  operator: z.enum([
    "eq",
    "neq",
    "gte",
    "lte",
    "contains",
    "in",
    "before_days",
    "after_days",
    "is_true",
    "is_false"
  ]),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number(), z.boolean()]))
  ]).optional()
});

export const marketingSegmentFiltersSchema = z.object({
  logic: z.enum(["AND", "OR"]).optional(),
  rules: z.array(marketingSegmentRuleSchema).max(80)
});

export const marketingSegmentFormSchema = z.object({
  name: z.string().trim().min(2, "Informe ao menos 2 caracteres.").max(160),
  description: z.string().trim().max(1200).optional(),
  kind: z.enum(["STATIC", "DYNAMIC"]).default("DYNAMIC"),
  filters: marketingSegmentFiltersSchema
});

export const marketingSegmentComposerSchema = z.object({
  name: z.string().trim().min(2, "Informe ao menos 2 caracteres.").max(160),
  description: z.string().trim().max(1200),
  kind: z.enum(["STATIC", "DYNAMIC"]),
  filtersText: z.string().trim().min(2, "Configure ao menos uma regra.").superRefine((value, context) => {
    try {
      const parsed = JSON.parse(value) as unknown;
      const parsedFilters = marketingSegmentFiltersSchema.safeParse(parsed);
      if (!parsedFilters.success) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: parsedFilters.error.issues[0]?.message ?? "Filtro invalido."
        });
      }
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Filtro precisa ser um JSON valido."
      });
    }
  })
});

export type MarketingSegmentRuleValues = z.infer<typeof marketingSegmentRuleSchema>;
export type MarketingSegmentFiltersValues = z.infer<typeof marketingSegmentFiltersSchema>;
export type MarketingSegmentFormValues = z.infer<typeof marketingSegmentFormSchema>;
export type MarketingSegmentComposerFormValues = z.infer<typeof marketingSegmentComposerSchema>;
