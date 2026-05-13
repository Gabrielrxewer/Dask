import { z } from "zod";

function isValidOptionalUrl(value: string): boolean {
  if (value.trim().length === 0) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeDocument(value: string): string {
  return value.replace(/\D/g, "");
}

function isValidOptionalCpfCnpj(value: string): boolean {
  const digits = normalizeDocument(value);
  return digits.length === 0 || digits.length === 11 || digits.length === 14;
}

export const companyProfileSettingsSchema = z.object({
  name: z.string().trim(),
  legalName: z.string().trim(),
  document: z.string().trim().refine(isValidOptionalCpfCnpj, {
    message: "Informe CPF ou CNPJ com 11 ou 14 digitos."
  }).transform(normalizeDocument),
  address: z.string().trim(),
  addressLine1: z.string().trim().default(""),
  addressLine2: z.string().trim().default(""),
  city: z.string().trim().default(""),
  state: z.string().trim().default(""),
  postalCode: z.string().trim().default("").transform((value) => value.replace(/\D/g, "")),
  country: z.string().trim().toUpperCase().default("BR"),
  businessType: z.enum(["individual", "company", "corporate"]).default("company"),
  jurisdictionCity: z.string().trim(),
  jurisdictionState: z.string().trim(),
  noticePeriod: z.string().trim().refine((value) => value === "" || /^\d+$/.test(value), {
    message: "Use apenas numeros."
  })
});

export const workspaceProfileSettingsFormSchema = z.object({
  workspaceName: z.string().trim().min(2, "O nome do workspace precisa ter pelo menos 2 caracteres."),
  workspaceKey: z.string().trim().toUpperCase().min(2, "A chave do workspace precisa ter pelo menos 2 caracteres."),
  workspaceWebsite: z.string().trim().refine(isValidOptionalUrl, {
    message: "Informe uma URL completa, iniciando com http:// ou https://."
  }),
  workspaceDescription: z.string().trim(),
  workspaceCompany: z.string().trim(),
  companyProfile: companyProfileSettingsSchema
});

export type CompanyProfileForm = z.input<typeof companyProfileSettingsSchema>;
export type WorkspaceProfileSettingsFormInput = z.input<typeof workspaceProfileSettingsFormSchema>;
export type WorkspaceProfileSettingsFormValues = z.output<typeof workspaceProfileSettingsFormSchema>;

export const emptyCompanyProfile: CompanyProfileForm = {
  name: "",
  legalName: "",
  document: "",
  address: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "BR",
  businessType: "company",
  jurisdictionCity: "",
  jurisdictionState: "",
  noticePeriod: ""
};

export const emptyWorkspaceProfileSettingsForm: WorkspaceProfileSettingsFormInput = {
  workspaceName: "",
  workspaceKey: "",
  workspaceWebsite: "",
  workspaceDescription: "",
  workspaceCompany: "",
  companyProfile: emptyCompanyProfile
};
