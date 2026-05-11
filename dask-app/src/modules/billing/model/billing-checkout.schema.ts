import { z } from "zod";
import { parseMoneyToCents } from "./billing-catalog-item.schema";

export function hasBrazilianFiscalDocument(value: string | null | undefined): boolean {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length === 11 || digits.length === 14;
}

export const billingCheckoutFormSchema = z.object({
  chargeSource: z.enum(["catalog", "manual"]),
  catalogItemId: z.string().trim().optional(),
  amount: z.string().trim().optional(),
  description: z.string().trim().optional(),
  customerId: z.string().trim().min(1, "Selecione um cliente cadastrado."),
  customerEmail: z.string().trim().email("Informe um e-mail valido."),
  customerDocument: z.string().trim().refine(hasBrazilianFiscalDocument, {
    message: "Cliente precisa ter CPF ou CNPJ valido antes do checkout."
  }),
  sendEmail: z.boolean().default(true)
}).superRefine((payload, ctx) => {
  if (payload.chargeSource === "catalog") {
    if (!payload.catalogItemId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["catalogItemId"],
        message: "Selecione um item de catalogo."
      });
    }
    return;
  }

  if (!payload.amount || parseMoneyToCents(payload.amount) === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["amount"],
      message: "Informe um valor maior que zero."
    });
  }
  if (!payload.description || payload.description.trim().length < 3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["description"],
      message: "Informe uma descricao para a cobranca."
    });
  }
});

export type BillingCheckoutFormValues = z.infer<typeof billingCheckoutFormSchema>;
