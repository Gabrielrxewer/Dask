import { z } from "zod";

export const fiscalWizardSchema = z.object({
  documentType: z.enum(["NFE", "NFSE"]),
  companyConfigId: z.string().trim().min(1, "Selecione uma empresa fiscal."),
  customerId: z.string().trim().min(1, "Selecione um cliente cadastrado."),
  customerName: z.string().trim().optional(),
  customerDocument: z.string().trim().min(11, "Cliente precisa ter CPF/CNPJ."),
  itemName: z.string().trim().min(2, "Informe o item fiscal."),
  quantity: z.string().trim().regex(/^\d+([,.]\d{1,4})?$/, "Informe uma quantidade valida."),
  unitPrice: z.string().trim().regex(/^\d+([,.]\d{1,2})?$/, "Informe um valor unitario valido."),
  discount: z.string().trim().regex(/^\d+([,.]\d{1,2})?$/, "Informe um desconto valido."),
  reference: z.string().trim().min(2, "Informe uma referencia."),
  notes: z.string().trim().optional()
});

export type FiscalWizardFormValues = z.infer<typeof fiscalWizardSchema>;
