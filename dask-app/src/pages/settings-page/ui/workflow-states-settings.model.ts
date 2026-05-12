import { z } from "zod";

export const DEFAULT_WORKFLOW_STATE_COLOR = "var(--text-secondary)";

export function toWorkflowStateSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const workflowStateFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres."),
  slug: z.string().trim(),
  color: z.string().trim().min(1, "Informe uma cor."),
  category: z.string().trim(),
  order: z.string().trim().refine((value) => value === "" || /^\d+$/.test(value), {
    message: "Use apenas numeros."
  }),
  isTerminal: z.boolean(),
  isEditable: z.boolean(),
  isActive: z.boolean()
}).transform((values) => ({
  ...values,
  slug: values.slug || toWorkflowStateSlug(values.name),
  order: values.order || "0"
})).refine((values) => values.slug.length > 0, {
  path: ["slug"],
  message: "Nao foi possivel gerar um slug valido para esse estado."
});

export type WorkflowStateFormInput = z.input<typeof workflowStateFormSchema>;
export type WorkflowStateFormValues = z.output<typeof workflowStateFormSchema>;
