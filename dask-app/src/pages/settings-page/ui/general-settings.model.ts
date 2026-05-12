import { z } from "zod";

export const companyProfileSettingsSchema = z.object({
  name: z.string().trim(),
  legalName: z.string().trim(),
  document: z.string().trim(),
  address: z.string().trim(),
  jurisdictionCity: z.string().trim(),
  jurisdictionState: z.string().trim(),
  noticePeriod: z.string().trim().refine((value) => value === "" || /^\d+$/.test(value), {
    message: "Use apenas numeros."
  })
});

export const workspaceProfileSettingsFormSchema = z.object({
  workspaceName: z.string().trim().min(2, "O nome do workspace precisa ter pelo menos 2 caracteres."),
  workspaceKey: z.string().trim().toUpperCase().min(2, "A chave do workspace precisa ter pelo menos 2 caracteres."),
  workspaceWebsite: z.string().trim(),
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
