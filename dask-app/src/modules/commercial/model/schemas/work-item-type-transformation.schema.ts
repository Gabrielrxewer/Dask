import { z } from "zod";

export const workItemTypeTransformationSchema = z.object({
  workItemId: z.string().trim().min(1, "WorkItem obrigatorio."),
  fromTypeId: z.string().trim().min(1, "Tipo de origem obrigatorio."),
  toTypeId: z.string().trim().min(1, "Tipo de destino obrigatorio."),
  defaultValuesForNewFields: z.record(z.string(), z.unknown()).optional()
});

export function buildWorkItemTypeTransformationSchema(requiredFieldKeys: string[]) {
  return workItemTypeTransformationSchema.superRefine((value, ctx) => {
    for (const fieldKey of requiredFieldKeys) {
      const fieldValue = value.defaultValuesForNewFields?.[fieldKey];
      const isBlank =
        fieldValue === undefined ||
        fieldValue === null ||
        (typeof fieldValue === "string" && fieldValue.trim().length === 0);
      if (isBlank) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Campo obrigatorio para transformar sem perder dados.",
          path: ["defaultValuesForNewFields", fieldKey]
        });
      }
    }
  });
}

export type WorkItemTypeTransformationValues = z.infer<typeof workItemTypeTransformationSchema>;
