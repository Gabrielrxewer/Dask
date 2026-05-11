import { z } from "zod";
import type { ProvisionWorkspaceWithProfileInput, WorkspaceTemplateOption } from "@/modules/workspace";

export type WorkspaceKind = "PERSONAL" | "CORPORATE";
export type WorkspaceSelectorView = "select" | "create";

export const EMPTY_TEMPLATE_VALUE = "__empty_template__";

export const workspaceKindOptions: Array<{ value: WorkspaceKind; label: string }> = [
  { value: "PERSONAL", label: "Pessoal" },
  { value: "CORPORATE", label: "Corporativo" }
];

export interface CompanyProfileForm {
  name: string;
  legalName: string;
  document: string;
  address: string;
  jurisdictionCity: string;
  jurisdictionState: string;
  noticePeriod: string;
}

export const emptyCompanyProfile: CompanyProfileForm = {
  name: "",
  legalName: "",
  document: "",
  address: "",
  jurisdictionCity: "",
  jurisdictionState: "",
  noticePeriod: ""
};

export const emptyWorkspaceCreateFormValues = {
  kind: "PERSONAL" as WorkspaceKind,
  templateKey: "" as WorkspaceTemplateOption["key"] | "",
  workspaceName: "",
  workspaceKey: "",
  workspaceDescription: "",
  workspaceWebsite: "",
  companyProfile: emptyCompanyProfile
};

const companyProfileSchema = z.object({
  name: z.string().trim().default(""),
  legalName: z.string().trim().default(""),
  document: z.string().trim().default(""),
  address: z.string().trim().default(""),
  jurisdictionCity: z.string().trim().default(""),
  jurisdictionState: z.string().trim().default(""),
  noticePeriod: z.string().trim().default("")
});

export const workspaceCreateFormSchema = z.object({
  kind: z.enum(["PERSONAL", "CORPORATE"]),
  templateKey: z.string().trim().min(1, "Selecione um template carregado pelo backend."),
  workspaceName: z.string().trim().min(2, "Informe um nome de workspace com pelo menos 2 caracteres."),
  workspaceKey: z
    .string()
    .trim()
    .min(2, "Informe uma chave de workspace com pelo menos 2 caracteres.")
    .max(20, "Use no maximo 20 caracteres.")
    .regex(/^[A-Z0-9]+$/, "Use apenas letras maiusculas e numeros."),
  workspaceDescription: z.string().trim().default(""),
  workspaceWebsite: z
    .string()
    .trim()
    .default("")
    .refine((value) => value.length === 0 || /^https?:\/\/\S+\.\S+/.test(value), {
      message: "Informe um website valido com http:// ou https://."
    }),
  companyProfile: companyProfileSchema
}).superRefine((value, ctx) => {
  if (value.kind === "CORPORATE" && value.companyProfile.name.trim().length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["companyProfile", "name"],
      message: "Informe o nome da empresa ou organizacao para workspace corporativo."
    });
  }
});

export type WorkspaceCreateFormValues = z.infer<typeof workspaceCreateFormSchema>;

export function makeWorkspaceKeyDraft(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 20);
}

function compactStringRecord<T extends object>(record: T): Partial<Record<keyof T, string>> {
  return Object.fromEntries(
    Object.entries(record as Record<string, string>)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value.length > 0)
  ) as Partial<Record<keyof T, string>>;
}

export function toProvisionWorkspaceMutationInput(
  values: WorkspaceCreateFormValues
): ProvisionWorkspaceWithProfileInput {
  const companyProfile = compactStringRecord(values.companyProfile);
  const profileInfo = compactStringRecord({
    description: values.workspaceDescription,
    company: values.companyProfile.name,
    website: values.workspaceWebsite
  });

  return {
    kind: values.kind,
    workspaceName: values.workspaceName.trim(),
    workspaceKey: values.workspaceKey.trim().toUpperCase(),
    templateKey: values.templateKey as WorkspaceTemplateOption["key"],
    organizationName: values.kind === "CORPORATE" ? values.companyProfile.name.trim() : undefined,
    profileInfo: Object.keys(profileInfo).length > 0 ? profileInfo : undefined,
    companyProfile: Object.keys(companyProfile).length > 0 ? companyProfile : undefined
  };
}
