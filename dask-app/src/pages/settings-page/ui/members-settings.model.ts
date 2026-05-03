import type { WorkspaceModuleKey, WorkspacePermissionKey } from "@/modules/workspace/model";

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" | "CLIENT";
export type ActiveTab = "members" | "invites" | "modules" | "groups" | "matrix";

export interface MemberEditorDraft {
  role: WorkspaceRole;
  allowOverrides: WorkspacePermissionKey[];
  denyOverrides: WorkspacePermissionKey[];
  groupIds: string[];
  allowedModules: WorkspaceModuleKey[];
  boardViewKeys: string;
  ownCardsOnly: boolean;
}

export interface GroupDraft {
  name: string;
  description: string;
  allow: WorkspacePermissionKey[];
  deny: WorkspacePermissionKey[];
  allowedModules: WorkspaceModuleKey[];
  boardViewKeys: string;
  ownCardsOnly: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MODULE_KEYS: WorkspaceModuleKey[] = [
  "board", "automation", "documentation", "billing", "ai", "settings", "fiscal", "leads", "marketing"
];

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
  board: { label: "Board", description: "Gestão de projetos e tarefas em quadros kanban" },
  automation: { label: "Automação", description: "Automações e fluxos de trabalho automáticos" },
  documentation: { label: "Documentação", description: "Wiki e base de conhecimento da equipe" },
  billing: { label: "Cobrança", description: "Histórico e cobranças do workspace" },
  ai: { label: "Inteligência Artificial", description: "Assistente de IA e geração de conteúdo" },
  settings: { label: "Configurações", description: "Acesso ao painel de configurações do workspace" },
  fiscal: { label: "Fiscal", description: "Emissão de notas fiscais e gestão fiscal" },
  leads: { label: "Leads", description: "Captação e qualificação de leads comerciais" },
  marketing: { label: "Marketing", description: "Campanhas, segmentação e analytics de marketing" },
};

export const PERMISSION_CATEGORY_PREFIXES: Array<{ prefix: string; label: string }> = [
  { prefix: "workspace.", label: "Workspace" },
  { prefix: "member.", label: "Membros" },
  { prefix: "role.", label: "Roles" },
  { prefix: "permission.", label: "Permissões" },
  { prefix: "project.", label: "Projetos" },
  { prefix: "board.", label: "Board" },
  { prefix: "item.", label: "Itens" },
  { prefix: "comment.", label: "Comentários" },
  { prefix: "file.", label: "Arquivos" },
  { prefix: "automation.", label: "Automação" },
  { prefix: "integration.", label: "Integrações" },
  { prefix: "billing.", label: "Cobrança" },
  { prefix: "fiscal.", label: "Fiscal" },
  { prefix: "lead.", label: "Leads" },
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
