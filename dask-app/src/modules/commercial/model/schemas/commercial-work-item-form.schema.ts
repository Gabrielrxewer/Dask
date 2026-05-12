import { z } from "zod";

const formString = z.string().trim();

export const commercialWorkItemFormSchema = z
  .object({
    customerId: formString,
    contactName: formString,
    contactEmail: formString.refine((value) => !value || z.string().email().safeParse(value).success, "E-mail invalido"),
    contactPhone: formString,
    companyName: formString,
    source: formString,
    interest: formString,
    estimatedValue: z
      .string()
      .trim()
      .refine((value) => !value || Number.isFinite(Number(value.replace(",", "."))), "Informe um valor valido."),
    proposalValidity: formString,
    notes: formString
  })
  .refine(
    (value) => Boolean(value.companyName || value.contactName || value.interest || value.customerId),
    {
      message: "Informe cliente, empresa, contato ou interesse para criar o WorkItem comercial.",
      path: ["companyName"]
    }
  );

export type CommercialWorkItemFormValues = z.infer<typeof commercialWorkItemFormSchema>;

export const workItemFormSchema = commercialWorkItemFormSchema;
export type WorkItemFormValues = CommercialWorkItemFormValues;
