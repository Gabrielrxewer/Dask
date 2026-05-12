import { z } from "zod";

const nullableText = z.string().trim().optional().or(z.literal("")).nullable();

export const customerFormSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do cliente."),
  tradeName: nullableText,
  legalName: nullableText,
  document: z.string().trim().max(40, "Documento muito longo.").optional().or(z.literal("")).nullable(),
  stateRegistration: nullableText,
  municipalRegistration: nullableText,
  taxRegime: nullableText,
  email: z.string().trim().email("E-mail invalido").optional().or(z.literal("")).nullable(),
  phone: z.string().trim().max(40, "Telefone muito longo.").optional().or(z.literal("")).nullable(),
  website: z.string().trim().url("URL invalida").optional().or(z.literal("")).nullable(),
  logoUrl: z.string().trim().url("URL invalida").optional().or(z.literal("")).nullable(),
  status: z.enum(["prospect", "active", "inactive", "archived"]),
  notes: nullableText,
  address: z
    .object({
      street: nullableText,
      number: nullableText,
      complement: nullableText,
      district: nullableText,
      city: nullableText,
      state: nullableText,
      zipCode: nullableText,
      country: nullableText
    })
    .optional()
    .nullable(),
  sourceWorkItemId: z.string().trim().optional().or(z.literal("")).nullable()
});

export type CustomerFormInputValues = z.input<typeof customerFormSchema>;
export type CustomerFormValues = z.infer<typeof customerFormSchema>;
