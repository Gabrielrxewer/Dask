import { z } from "zod";
import type { WorkspaceModuleKey, WorkspacePermissionKey } from "@/modules/workspace/model";

const WORKSPACE_ROLE_VALUES = ["OWNER", "ADMIN", "MEMBER", "VIEWER", "CLIENT"] as const;
const ASSIGNABLE_ROLE_VALUES = ["ADMIN", "MEMBER", "VIEWER", "CLIENT"] as const;
const WORKSPACE_MODULE_KEY_VALUES = [
  "dashboard", "board", "automation", "documentation", "billing", "ai", "settings", "fiscal", "commercial", "marketing"
] as const satisfies readonly WorkspaceModuleKey[];

const workspacePermissionKeySchema = z.custom<WorkspacePermissionKey>(
  (value) => typeof value === "string" && value.trim().length > 0,
  { message: "Permissao invalida." }
);

export const workspaceRoleSchema = z.enum(WORKSPACE_ROLE_VALUES);
export const assignableWorkspaceRoleSchema = z.enum(ASSIGNABLE_ROLE_VALUES);
export const workspaceModuleKeySchema = z.enum(WORKSPACE_MODULE_KEY_VALUES);

export const workspaceInviteFormSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail valido."),
  role: assignableWorkspaceRoleSchema
});

export const memberAccessFormSchema = z.object({
  role: workspaceRoleSchema,
  allowOverrides: z.array(workspacePermissionKeySchema),
  denyOverrides: z.array(workspacePermissionKeySchema),
  groupIds: z.array(z.string().trim().min(1, "Grupo invalido.")),
  allowedModules: z.array(workspaceModuleKeySchema),
  boardViewKeys: z.string().trim(),
  ownCardsOnly: z.boolean()
});

export const accessGroupFormSchema = z.object({
  name: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres."),
  description: z.string().trim(),
  allow: z.array(workspacePermissionKeySchema),
  deny: z.array(workspacePermissionKeySchema),
  allowedModules: z.array(workspaceModuleKeySchema),
  boardViewKeys: z.string().trim(),
  ownCardsOnly: z.boolean()
});

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
export type ActiveTab = "members" | "invites" | "modules" | "groups" | "matrix";
export type WorkspaceInviteFormInput = z.input<typeof workspaceInviteFormSchema>;
export type WorkspaceInviteFormValues = z.output<typeof workspaceInviteFormSchema>;
export type MemberEditorDraft = z.output<typeof memberAccessFormSchema>;
export type GroupDraft = z.output<typeof accessGroupFormSchema>;

// ─── Constants ────────────────────────────────────────────────────────────────

export const MODULE_KEYS: WorkspaceModuleKey[] = [...WORKSPACE_MODULE_KEY_VALUES];

export const TAB_ITEMS: Array<{ id: ActiveTab; label: string }> = [
  { id: "members", label: "Membros" },
  { id: "invites", label: "Convites" },
  { id: "modules", label: "Módulos" },
  { id: "groups", label: "Grupos de acesso" },
  { id: "matrix", label: "Matriz de permissões" },
];

export const ASSIGNABLE_ROLES: Array<{ value: WorkspaceRole; label: string; description: string }> = [
  { value: "ADMIN", label: "Admin", description: "Acesso total exceto ownership" },
  { value: "MEMBER", label: "Membro", description: "Acesso padrão ao workspace" },
  { value: "VIEWER", label: "Visualizador", description: "Somente leitura" },
  { value: "CLIENT", label: "Cliente", description: "Acesso restrito aos dados vinculados ao cliente" },
];

export const ROLE_LABELS: Record<string, string> = {
  OWNER: "Proprietário",
  ADMIN: "Admin",
  MEMBER: "Membro",
  VIEWER: "Visualizador",
  CLIENT: "Cliente",
  MANAGER: "Gerente",
  GUEST: "Convidado",
};

export const ROLE_TONES: Record<string, "default" | "success" | "warning"> = {
  OWNER: "warning",
  ADMIN: "success",
  MEMBER: "default",
  VIEWER: "default",
  CLIENT: "default",
  MANAGER: "success",
  GUEST: "default",
};

export const MODULE_META: Record<WorkspaceModuleKey, { label: string; description: string }> = {
  dashboard: { label: "Dashboard", description: "Indicadores de CRM, funil operacional e automações" },
  board: { label: "Board", description: "Gestão de projetos e tarefas em quadros kanban" },
  automation: { label: "Automação", description: "Automações e fluxos de trabalho automáticos" },
  documentation: { label: "Documentação", description: "Wiki e base de conhecimento da equipe" },
  billing: { label: "Cobrança", description: "Histórico e cobranças do workspace" },
  ai: { label: "Inteligência Artificial", description: "Assistente de IA e geração de conteúdo" },
  settings: { label: "Configurações", description: "Acesso ao painel de configurações do workspace" },
  fiscal: { label: "Fiscal", description: "Emissão de notas fiscais e gestão fiscal" },
  commercial: { label: "Comercial", description: "Captação e qualificação de sinais e oportunidades comerciais" },
  marketing: { label: "Marketing", description: "Campanhas, segmentação e analytics de marketing" },
};

export const PERMISSION_CATEGORY_PREFIXES: Array<{ prefix: string; label: string }> = [
  { prefix: "workspace.", label: "Workspace" },
  { prefix: "member.", label: "Membros" },
  { prefix: "role.", label: "Roles" },
  { prefix: "permission.", label: "Permissões" },
  { prefix: "dashboard.", label: "Dashboard" },
  { prefix: "project.", label: "Projetos" },
  { prefix: "board.", label: "Board" },
  { prefix: "item.", label: "Itens" },
  { prefix: "comment.", label: "Comentários" },
  { prefix: "file.", label: "Arquivos" },
  { prefix: "automation.", label: "Automação" },
  { prefix: "integration.", label: "Integrações" },
  { prefix: "billing.", label: "Cobrança" },
  { prefix: "fiscal.", label: "Fiscal" },
  { prefix: "commercial.", label: "Comercial" },
  { prefix: "marketing.", label: "Marketing" },
  { prefix: "audit.", label: "Auditoria" },
  { prefix: "ai.", label: "IA" },
];

export const MATRIX_ROLES: Array<"OWNER" | "ADMIN" | "MEMBER" | "VIEWER" | "CLIENT" | "MANAGER" | "GUEST"> =
  ["OWNER", "ADMIN", "MEMBER", "VIEWER", "CLIENT", "MANAGER", "GUEST"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getCategoryLabel(key: string): string {
  for (const { prefix, label } of PERMISSION_CATEGORY_PREFIXES) {
    if (key.startsWith(prefix)) return label;
  }
  return "Outros";
}

export function groupedPermissions(
  permissions: WorkspacePermissionKey[]
): Array<{ label: string; keys: WorkspacePermissionKey[] }> {
  const map = new Map<string, WorkspacePermissionKey[]>();
  for (const key of permissions) {
    const cat = getCategoryLabel(key);
    const existing = map.get(cat);
    if (existing) existing.push(key);
    else map.set(cat, [key]);
  }
  return Array.from(map.entries()).map(([label, keys]) => ({ label, keys }));
}

export function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

export function splitKeys(input: string): string[] {
  return Array.from(new Set(input.split(",").map(s => s.trim()).filter(Boolean)));
}
