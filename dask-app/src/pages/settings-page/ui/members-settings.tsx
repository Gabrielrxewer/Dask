import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { workspaceService } from "@/modules/workspace/api";
import { useWorkspace } from "@/modules/workspace";
import type {
  WorkspaceAccessControlSnapshot,
  WorkspaceAccessGroup,
  WorkspaceAccessControlMember,
  WorkspaceInvite,
  WorkspaceModuleKey,
  WorkspacePermissionKey
} from "@/modules/workspace/model";
import {
  Button,
  FormField,
  MetricCard,
  ModalShell,
  Section,
  StatusBadge,
  Tabs,
  TextInput,
  UserAvatar
} from "@/shared/ui";
import "./members-settings.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
type ActiveTab = "members" | "invites" | "modules" | "groups" | "matrix";

interface MemberEditorDraft {
  role: WorkspaceRole;
  allowOverrides: WorkspacePermissionKey[];
  denyOverrides: WorkspacePermissionKey[];
  groupIds: string[];
  allowedModules: WorkspaceModuleKey[];
  boardViewKeys: string;
  ownCardsOnly: boolean;
}

interface GroupDraft {
  name: string;
  description: string;
  allow: WorkspacePermissionKey[];
  deny: WorkspacePermissionKey[];
  allowedModules: WorkspaceModuleKey[];
  boardViewKeys: string;
  ownCardsOnly: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MODULE_KEYS: WorkspaceModuleKey[] = [
  "board", "automation", "documentation", "ai", "settings", "fiscal", "leads", "marketing"
];

const TAB_ITEMS: Array<{ id: ActiveTab; label: string }> = [
  { id: "members", label: "Membros" },
  { id: "invites", label: "Convites" },
  { id: "modules", label: "Módulos" },
  { id: "groups", label: "Grupos de acesso" },
  { id: "matrix", label: "Matriz de permissões" },
];

const ASSIGNABLE_ROLES: Array<{ value: WorkspaceRole; label: string; description: string }> = [
  { value: "ADMIN", label: "Admin", description: "Acesso total exceto ownership" },
  { value: "MEMBER", label: "Membro", description: "Acesso padrão ao workspace" },
  { value: "VIEWER", label: "Visualizador", description: "Somente leitura" },
];

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Proprietário",
  ADMIN: "Admin",
  MEMBER: "Membro",
  VIEWER: "Visualizador",
  MANAGER: "Gerente",
  GUEST: "Convidado",
};

const ROLE_TONES: Record<string, "default" | "success" | "warning"> = {
  OWNER: "warning",
  ADMIN: "success",
  MEMBER: "default",
  VIEWER: "default",
  MANAGER: "success",
  GUEST: "default",
};

const MODULE_META: Record<WorkspaceModuleKey, { label: string; description: string }> = {
  board: { label: "Board", description: "Gestão de projetos e tarefas em quadros kanban" },
  automation: { label: "Automação", description: "Automações e fluxos de trabalho automáticos" },
  documentation: { label: "Documentação", description: "Wiki e base de conhecimento da equipe" },
  ai: { label: "Inteligência Artificial", description: "Assistente de IA e geração de conteúdo" },
  settings: { label: "Configurações", description: "Acesso ao painel de configurações do workspace" },
  fiscal: { label: "Fiscal", description: "Emissão de notas fiscais e gestão fiscal" },
  leads: { label: "Leads", description: "Captação e qualificação de leads comerciais" },
  marketing: { label: "Marketing", description: "Campanhas, segmentação e analytics de marketing" },
};

const PERMISSION_CATEGORY_PREFIXES: Array<{ prefix: string; label: string }> = [
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

const MATRIX_ROLES: Array<"OWNER" | "ADMIN" | "MEMBER" | "VIEWER" | "MANAGER" | "GUEST"> =
  ["OWNER", "ADMIN", "MEMBER", "VIEWER", "MANAGER", "GUEST"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryLabel(key: string): string {
  for (const { prefix, label } of PERMISSION_CATEGORY_PREFIXES) {
    if (key.startsWith(prefix)) return label;
  }
  return "Outros";
}

function groupedPermissions(
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

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function splitKeys(input: string): string[] {
  return Array.from(new Set(input.split(",").map(s => s.trim()).filter(Boolean)));
}

// ─── PermissionPicker ─────────────────────────────────────────────────────────

function PermissionPicker({
  catalog,
  selected,
  onChange,
  disabled = false,
}: {
  catalog: WorkspacePermissionKey[];
  selected: WorkspacePermissionKey[];
  onChange: (keys: WorkspacePermissionKey[]) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const filtered = search ? catalog.filter(k => k.includes(search.toLowerCase())) : catalog;
  const groups = groupedPermissions(filtered);

  const toggle = (key: WorkspacePermissionKey) => {
    onChange(selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key]);
  };

  return (
    <div className="ms-perm-picker">
      <div className="ms-perm-picker__search">
        <TextInput value={search} placeholder="Buscar permissão..." onChange={e => setSearch(e.target.value)} />
      </div>
      {selected.length > 0 && (
        <div className="ms-chips">
          {selected.map(key => (
            <span key={key} className="ms-chip">
              {key}
              {!disabled && (
                <button
                  type="button"
                  className="ms-chip__remove"
                  onClick={() => toggle(key)}
                  aria-label={`Remover ${key}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="ms-perm-picker__list">
        {groups.length === 0 ? (
          <p className="ms-hint">Nenhuma permissão encontrada.</p>
        ) : (
          groups.map(({ label, keys }) => (
            <div key={label} className="ms-perm-picker__group">
              <p className="ms-perm-picker__group-label">{label}</p>
              {keys.map(key => (
                <label key={key} className="ms-perm-picker__item">
                  <input
                    type="checkbox"
                    checked={selected.includes(key)}
                    onChange={() => toggle(key)}
                    disabled={disabled}
                  />
                  <span>{key}</span>
                </label>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── ModulePicker ─────────────────────────────────────────────────────────────

function ModulePicker({
  selected,
  onChange,
  disabled = false,
}: {
  selected: WorkspaceModuleKey[];
  onChange: (keys: WorkspaceModuleKey[]) => void;
  disabled?: boolean;
}) {
  const toggle = (key: WorkspaceModuleKey) => {
    onChange(selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key]);
  };
  return (
    <div className="ms-module-picker">
      {MODULE_KEYS.map(key => (
        <button
          key={key}
          type="button"
          className={`ms-module-chip${selected.includes(key) ? " ms-module-chip--active" : ""}`}
          onClick={() => toggle(key)}
          disabled={disabled}
        >
          {MODULE_META[key].label}
        </button>
      ))}
    </div>
  );
}

// ─── GroupPicker ──────────────────────────────────────────────────────────────

function GroupPicker({
  groups,
  selected,
  onChange,
  disabled = false,
}: {
  groups: WorkspaceAccessGroup[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(g => g !== id) : [...selected, id]);
  };
  if (groups.length === 0) {
    return <p className="ms-hint">Nenhum grupo de acesso criado ainda.</p>;
  }
  return (
    <div className="ms-group-picker">
      {groups.map(group => (
        <label key={group.id} className="ms-group-picker__item">
          <input
            type="checkbox"
            checked={selected.includes(group.id)}
            onChange={() => toggle(group.id)}
            disabled={disabled}
          />
          <div className="ms-group-picker__info">
            <strong>{group.name}</strong>
            {group.description && <span>{group.description}</span>}
          </div>
        </label>
      ))}
    </div>
  );
}

// ─── MemberAccessEditorDrawer ─────────────────────────────────────────────────

type MemberEditorSection = "role" | "groups" | "allow" | "deny" | "modules" | "summary";

function MemberAccessEditorDrawer({
  member,
  accessControl,
  onSave,
  onClose,
}: {
  member: WorkspaceAccessControlMember;
  accessControl: WorkspaceAccessControlSnapshot;
  onSave: (userId: string, draft: MemberEditorDraft) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<MemberEditorDraft>({
    role: member.role,
    allowOverrides: member.overrides.allow,
    denyOverrides: member.overrides.deny,
    groupIds: member.overrides.groupIds ?? [],
    allowedModules: member.overrides.allowedModules ?? [],
    boardViewKeys: (member.overrides.allowedBoardViewKeys ?? []).join(", "),
    ownCardsOnly: member.overrides.ownCardsOnly === true,
  });
  const [section, setSection] = useState<MemberEditorSection>("role");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const isOwner = member.role === "OWNER";
  const catalog = accessControl.catalog;
  const groups = accessControl.groups ?? [];
  const rolePerms = accessControl.rolePresets[draft.role] ?? [];

  const groupPerms = useMemo(() => {
    const allow = new Set<WorkspacePermissionKey>();
    const deny = new Set<WorkspacePermissionKey>();
    for (const gid of draft.groupIds) {
      const group = groups.find(g => g.id === gid);
      if (!group) continue;
      (group.allow ?? []).forEach(p => allow.add(p));
      (group.deny ?? []).forEach(p => deny.add(p));
    }
    return { allow: Array.from(allow), deny: Array.from(deny) };
  }, [draft.groupIds, groups]);

  const effective = useMemo(() => {
    const base = new Set(rolePerms);
    groupPerms.allow.forEach(p => base.add(p));
    draft.allowOverrides.forEach(p => base.add(p));
    groupPerms.deny.forEach(p => base.delete(p));
    draft.denyOverrides.forEach(p => base.delete(p));
    return Array.from(base);
  }, [rolePerms, groupPerms, draft.allowOverrides, draft.denyOverrides]);

  const handleSave = async () => {
    setIsSaving(true);
    setError("");
    try {
      await onSave(member.userId, draft);
    } catch {
      setError("Não foi possível salvar as alterações.");
      setIsSaving(false);
    }
  };

  const SECTIONS: Array<{ id: MemberEditorSection; label: string }> = [
    { id: "role", label: "Role" },
    { id: "groups", label: "Grupos" },
    { id: "allow", label: "Allow" },
    { id: "deny", label: "Deny" },
    { id: "modules", label: "Módulos" },
    { id: "summary", label: "Resumo" },
  ];

  return (
    <ModalShell titleId="member-editor-title" onClose={onClose} className="ms-drawer">
      <div className="ms-drawer__header">
        <UserAvatar alt={member.name} initials={getInitials(member.name)} size="md" />
        <div className="ms-drawer__header-info">
          <h2 id="member-editor-title">{member.name}</h2>
          <p>{member.email || "Sem e-mail visível"}</p>
        </div>
        <button type="button" className="ms-drawer__close" onClick={onClose} aria-label="Fechar">×</button>
      </div>

      {isOwner && (
        <div className="ms-drawer__owner-banner">
          Proprietário do workspace — acesso total, não editável.
        </div>
      )}

      <div className="ms-drawer__nav">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            type="button"
            className={`ms-drawer__nav-btn${section === s.id ? " ms-drawer__nav-btn--active" : ""}`}
            onClick={() => setSection(s.id)}
          >
            {s.label}
            {s.id === "allow" && draft.allowOverrides.length > 0 && (
              <span className="ms-badge ms-badge--green">{draft.allowOverrides.length}</span>
            )}
            {s.id === "deny" && draft.denyOverrides.length > 0 && (
              <span className="ms-badge ms-badge--red">{draft.denyOverrides.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="ms-drawer__body">
        {section === "role" && (
          <div className="ms-drawer__section">
            <p className="ms-drawer__section-hint">Define o nível base de acesso deste membro.</p>
            <div className="ms-role-selector">
              {(["OWNER", "ADMIN", "MEMBER", "VIEWER"] as WorkspaceRole[]).map(role => (
                <button
                  key={role}
                  type="button"
                  className={`ms-role-btn${draft.role === role ? " ms-role-btn--active" : ""}`}
                  onClick={() => setDraft(d => ({ ...d, role }))}
                  disabled={isOwner || isSaving || role === "OWNER"}
                >
                  <strong>{ROLE_LABELS[role]}</strong>
                  <span>
                    {role === "OWNER"
                      ? "Proprietário do workspace"
                      : ASSIGNABLE_ROLES.find(r => r.value === role)?.description}
                  </span>
                </button>
              ))}
            </div>
            <div className="ms-perm-source">
              <p className="ms-perm-source__label">
                Permissões da role {ROLE_LABELS[draft.role]} ({rolePerms.length})
              </p>
              <div className="ms-chips ms-chips--sm">
                {rolePerms.slice(0, 14).map(p => (
                  <span key={p} className="ms-chip ms-chip--role">{p}</span>
                ))}
                {rolePerms.length > 14 && (
                  <span className="ms-chip ms-chip--more">+{rolePerms.length - 14} mais</span>
                )}
              </div>
            </div>
          </div>
        )}

        {section === "groups" && (
          <div className="ms-drawer__section">
            <p className="ms-drawer__section-hint">
              Grupos aplicam permissões coletivas a este membro.
            </p>
            <GroupPicker
              groups={groups}
              selected={draft.groupIds}
              onChange={ids => setDraft(d => ({ ...d, groupIds: ids }))}
              disabled={isOwner || isSaving}
            />
            {groupPerms.allow.length > 0 && (
              <div className="ms-perm-source">
                <p className="ms-perm-source__label">
                  Permissões adicionadas pelos grupos ({groupPerms.allow.length})
                </p>
                <div className="ms-chips ms-chips--sm">
                  {groupPerms.allow.map(p => (
                    <span key={p} className="ms-chip ms-chip--group">{p}</span>
                  ))}
                </div>
              </div>
            )}
            {groupPerms.deny.length > 0 && (
              <div className="ms-perm-source ms-perm-source--deny">
                <p className="ms-perm-source__label">
                  Restrições dos grupos ({groupPerms.deny.length})
                </p>
                <div className="ms-chips ms-chips--sm">
                  {groupPerms.deny.map(p => (
                    <span key={p} className="ms-chip ms-chip--deny">{p}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {section === "allow" && (
          <div className="ms-drawer__section">
            <p className="ms-drawer__section-hint">
              Permissões extras concedidas individualmente, além da role e grupos.
            </p>
            <PermissionPicker
              catalog={catalog}
              selected={draft.allowOverrides}
              onChange={keys => setDraft(d => ({ ...d, allowOverrides: keys }))}
              disabled={isOwner || isSaving}
            />
          </div>
        )}

        {section === "deny" && (
          <div className="ms-drawer__section">
            <p className="ms-drawer__section-hint">
              Permissões bloqueadas individualmente, mesmo que venham da role ou de grupos.
            </p>
            <PermissionPicker
              catalog={catalog}
              selected={draft.denyOverrides}
              onChange={keys => setDraft(d => ({ ...d, denyOverrides: keys }))}
              disabled={isOwner || isSaving}
            />
          </div>
        )}

        {section === "modules" && (
          <div className="ms-drawer__section">
            <p className="ms-drawer__section-hint">
              Módulos do workspace acessíveis a este membro.
            </p>
            <FormField label="Módulos habilitados">
              <ModulePicker
                selected={draft.allowedModules}
                onChange={keys => setDraft(d => ({ ...d, allowedModules: keys }))}
                disabled={isOwner || isSaving}
              />
            </FormField>
            <FormField label="Views do board permitidas (separadas por vírgula)">
              <TextInput
                value={draft.boardViewKeys}
                placeholder="kanban, list, timeline..."
                onChange={e => setDraft(d => ({ ...d, boardViewKeys: e.target.value }))}
                disabled={isOwner || isSaving}
              />
            </FormField>
            <label className="ms-toggle-label">
              <input
                type="checkbox"
                checked={draft.ownCardsOnly}
                onChange={e => setDraft(d => ({ ...d, ownCardsOnly: e.target.checked }))}
                disabled={isOwner || isSaving}
              />
              <span>Mostrar somente cards do próprio membro</span>
            </label>
          </div>
        )}

        {section === "summary" && (
          <div className="ms-drawer__section">
            <div className="ms-perm-breakdown">
              <div className="ms-perm-breakdown__layer">
                <div className="ms-perm-breakdown__layer-header">
                  <span className="ms-perm-breakdown__layer-icon ms-perm-breakdown__layer-icon--role" />
                  <strong>Role base — {ROLE_LABELS[draft.role]}</strong>
                  <span className="ms-badge">{rolePerms.length}</span>
                </div>
                <div className="ms-chips ms-chips--sm">
                  {rolePerms.slice(0, 10).map(p => (
                    <span key={p} className="ms-chip ms-chip--role">{p}</span>
                  ))}
                  {rolePerms.length > 10 && (
                    <span className="ms-chip ms-chip--more">+{rolePerms.length - 10}</span>
                  )}
                </div>
              </div>

              {(groupPerms.allow.length > 0 || groupPerms.deny.length > 0) && (
                <div className="ms-perm-breakdown__layer">
                  <div className="ms-perm-breakdown__layer-header">
                    <span className="ms-perm-breakdown__layer-icon ms-perm-breakdown__layer-icon--group" />
                    <strong>Grupos ({draft.groupIds.length})</strong>
                    {groupPerms.allow.length > 0 && (
                      <span className="ms-badge ms-badge--green">+{groupPerms.allow.length}</span>
                    )}
                    {groupPerms.deny.length > 0 && (
                      <span className="ms-badge ms-badge--red">−{groupPerms.deny.length}</span>
                    )}
                  </div>
                  <div className="ms-chips ms-chips--sm">
                    {groupPerms.allow.map(p => (
                      <span key={`a-${p}`} className="ms-chip ms-chip--group">{p}</span>
                    ))}
                    {groupPerms.deny.map(p => (
                      <span key={`d-${p}`} className="ms-chip ms-chip--deny">{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {(draft.allowOverrides.length > 0 || draft.denyOverrides.length > 0) && (
                <div className="ms-perm-breakdown__layer">
                  <div className="ms-perm-breakdown__layer-header">
                    <span className="ms-perm-breakdown__layer-icon ms-perm-breakdown__layer-icon--override" />
                    <strong>Overrides individuais</strong>
                    {draft.allowOverrides.length > 0 && (
                      <span className="ms-badge ms-badge--green">+{draft.allowOverrides.length}</span>
                    )}
                    {draft.denyOverrides.length > 0 && (
                      <span className="ms-badge ms-badge--red">−{draft.denyOverrides.length}</span>
                    )}
                  </div>
                  <div className="ms-chips ms-chips--sm">
                    {draft.allowOverrides.map(p => (
                      <span key={`a-${p}`} className="ms-chip ms-chip--allow">{p}</span>
                    ))}
                    {draft.denyOverrides.map(p => (
                      <span key={`d-${p}`} className="ms-chip ms-chip--deny">{p}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="ms-perm-breakdown__effective">
                <div className="ms-perm-breakdown__layer-header">
                  <strong>Acesso efetivo</strong>
                  <span className="ms-badge ms-badge--blue">{effective.length} permissões</span>
                </div>
                <div className="ms-chips ms-chips--sm">
                  {effective.slice(0, 24).map(p => (
                    <span key={p} className="ms-chip">{p}</span>
                  ))}
                  {effective.length > 24 && (
                    <span className="ms-chip ms-chip--more">+{effective.length - 24} mais</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <p className="ms-drawer__error">{error}</p>}

      <div className="ms-drawer__footer">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
          Cancelar
        </Button>
        {!isOwner && (
          <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar acesso"}
          </Button>
        )}
      </div>
    </ModalShell>
  );
}

// ─── AccessGroupEditorDrawer ──────────────────────────────────────────────────

type GroupEditorSection = "info" | "allow" | "deny" | "modules";

function AccessGroupEditorDrawer({
  catalog,
  group,
  onSave,
  onClose,
}: {
  catalog: WorkspacePermissionKey[];
  group?: WorkspaceAccessGroup;
  onSave: (draft: GroupDraft) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<GroupDraft>({
    name: group?.name ?? "",
    description: group?.description ?? "",
    allow: group?.allow ?? [],
    deny: group?.deny ?? [],
    allowedModules: group?.allowedModules ?? [],
    boardViewKeys: (group?.allowedBoardViewKeys ?? []).join(", "),
    ownCardsOnly: group?.ownCardsOnly === true,
  });
  const [section, setSection] = useState<GroupEditorSection>("info");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!draft.name.trim()) {
      setError("Informe um nome para o grupo.");
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      await onSave(draft);
    } catch {
      setError("Não foi possível salvar o grupo.");
      setIsSaving(false);
    }
  };

  const SECTIONS: Array<{ id: GroupEditorSection; label: string }> = [
    { id: "info", label: "Informações" },
    { id: "allow", label: "Permitir" },
    { id: "deny", label: "Bloquear" },
    { id: "modules", label: "Módulos" },
  ];

  return (
    <ModalShell titleId="group-editor-title" onClose={onClose} className="ms-drawer">
      <div className="ms-drawer__header">
        <div className="ms-drawer__header-info ms-drawer__header-info--full">
          <h2 id="group-editor-title">
            {group ? `Editar grupo: ${group.name}` : "Novo grupo de acesso"}
          </h2>
          <p>Defina permissões e restrições para aplicar a múltiplos membros</p>
        </div>
        <button type="button" className="ms-drawer__close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
      </div>

      <div className="ms-drawer__nav">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            type="button"
            className={`ms-drawer__nav-btn${section === s.id ? " ms-drawer__nav-btn--active" : ""}`}
            onClick={() => setSection(s.id)}
          >
            {s.label}
            {s.id === "allow" && draft.allow.length > 0 && (
              <span className="ms-badge ms-badge--green">{draft.allow.length}</span>
            )}
            {s.id === "deny" && draft.deny.length > 0 && (
              <span className="ms-badge ms-badge--red">{draft.deny.length}</span>
            )}
            {s.id === "modules" && draft.allowedModules.length > 0 && (
              <span className="ms-badge ms-badge--blue">{draft.allowedModules.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="ms-drawer__body">
        {section === "info" && (
          <div className="ms-drawer__section">
            <FormField label="Nome do grupo">
              <TextInput
                value={draft.name}
                placeholder="Ex: Time de Vendas"
                onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                disabled={isSaving}
              />
            </FormField>
            <FormField label="Descrição (opcional)">
              <TextInput
                value={draft.description}
                placeholder="Descreva o propósito deste grupo..."
                onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                disabled={isSaving}
              />
            </FormField>

            {(draft.allow.length > 0 || draft.deny.length > 0 || draft.allowedModules.length > 0) && (
              <div className="ms-group-preview">
                <p className="ms-group-preview__label">Preview do grupo</p>
                {draft.allow.length > 0 && (
                  <div className="ms-chips ms-chips--sm">
                    <span className="ms-perm-source__label">Permite:</span>
                    {draft.allow.slice(0, 5).map(p => (
                      <span key={p} className="ms-chip ms-chip--allow">{p}</span>
                    ))}
                    {draft.allow.length > 5 && (
                      <span className="ms-chip ms-chip--more">+{draft.allow.length - 5}</span>
                    )}
                  </div>
                )}
                {draft.deny.length > 0 && (
                  <div className="ms-chips ms-chips--sm">
                    <span className="ms-perm-source__label">Bloqueia:</span>
                    {draft.deny.slice(0, 5).map(p => (
                      <span key={p} className="ms-chip ms-chip--deny">{p}</span>
                    ))}
                    {draft.deny.length > 5 && (
                      <span className="ms-chip ms-chip--more">+{draft.deny.length - 5}</span>
                    )}
                  </div>
                )}
                {draft.allowedModules.length > 0 && (
                  <div className="ms-chips ms-chips--sm">
                    <span className="ms-perm-source__label">Módulos:</span>
                    {draft.allowedModules.map(m => (
                      <span key={m} className="ms-chip ms-chip--module">{MODULE_META[m].label}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {section === "allow" && (
          <div className="ms-drawer__section">
            <p className="ms-drawer__section-hint">
              Permissões concedidas aos membros deste grupo.
            </p>
            <PermissionPicker
              catalog={catalog}
              selected={draft.allow}
              onChange={keys => setDraft(d => ({ ...d, allow: keys }))}
              disabled={isSaving}
            />
          </div>
        )}

        {section === "deny" && (
          <div className="ms-drawer__section">
            <p className="ms-drawer__section-hint">
              Permissões bloqueadas para os membros deste grupo.
            </p>
            <PermissionPicker
              catalog={catalog}
              selected={draft.deny}
              onChange={keys => setDraft(d => ({ ...d, deny: keys }))}
              disabled={isSaving}
            />
          </div>
        )}

        {section === "modules" && (
          <div className="ms-drawer__section">
            <FormField label="Módulos habilitados para este grupo">
              <ModulePicker
                selected={draft.allowedModules}
                onChange={keys => setDraft(d => ({ ...d, allowedModules: keys }))}
                disabled={isSaving}
              />
            </FormField>
            <FormField label="Views do board permitidas (separadas por vírgula)">
              <TextInput
                value={draft.boardViewKeys}
                placeholder="kanban, list, timeline..."
                onChange={e => setDraft(d => ({ ...d, boardViewKeys: e.target.value }))}
                disabled={isSaving}
              />
            </FormField>
            <label className="ms-toggle-label">
              <input
                type="checkbox"
                checked={draft.ownCardsOnly}
                onChange={e => setDraft(d => ({ ...d, ownCardsOnly: e.target.checked }))}
                disabled={isSaving}
              />
              <span>Mostrar somente cards próprios</span>
            </label>
          </div>
        )}
      </div>

      {error && <p className="ms-drawer__error">{error}</p>}

      <div className="ms-drawer__footer">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
          Cancelar
        </Button>
        <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
          {isSaving ? "Salvando..." : group ? "Salvar alterações" : "Criar grupo"}
        </Button>
      </div>
    </ModalShell>
  );
}

// ─── PermissionsMatrix ────────────────────────────────────────────────────────

function PermissionsMatrix({ accessControl }: { accessControl: WorkspaceAccessControlSnapshot }) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const filtered = search
    ? accessControl.catalog.filter(p => p.toLowerCase().includes(search.toLowerCase()))
    : accessControl.catalog;
  const groups = groupedPermissions(filtered);

  const toggleCollapse = (label: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <div className="ms-matrix">
      <div className="ms-matrix__search">
        <TextInput
          value={search}
          placeholder="Buscar permissão..."
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className="ms-matrix__wrap">
        <div className="ms-matrix__table">
          <div className="ms-matrix__header">
            <div className="ms-matrix__perm-col">Permissão</div>
            {MATRIX_ROLES.map(role => (
              <div key={role} className="ms-matrix__role-col">{ROLE_LABELS[role]}</div>
            ))}
          </div>
          {groups.map(({ label, keys }) => (
            <div key={label} className="ms-matrix__group">
              <button
                type="button"
                className="ms-matrix__group-header"
                onClick={() => toggleCollapse(label)}
              >
                <span className="ms-matrix__group-chevron">
                  {collapsed.has(label) ? "▶" : "▼"}
                </span>
                <span>{label}</span>
                <span className="ms-badge">{keys.length}</span>
              </button>
              {!collapsed.has(label) && keys.map(permission => (
                <div key={permission} className="ms-matrix__row">
                  <div className="ms-matrix__perm-col">{permission}</div>
                  {MATRIX_ROLES.map(role => {
                    const has = accessControl.rolePresets[role]?.includes(permission) === true;
                    return (
                      <div
                        key={role}
                        className={`ms-matrix__role-col ms-matrix__cell ${has ? "ms-matrix__cell--yes" : "ms-matrix__cell--no"}`}
                      >
                        {has ? "✓" : "—"}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MembersSettings (main) ───────────────────────────────────────────────────

export function MembersSettings() {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const { snapshot } = useWorkspace();

  const [isCorporateWorkspace, setIsCorporateWorkspace] = useState(false);
  const [isLoadingWorkspaceInfo, setIsLoadingWorkspaceInfo] = useState(true);
  const [isLoadingAccessControl, setIsLoadingAccessControl] = useState(false);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);
  const [accessControl, setAccessControl] = useState<WorkspaceAccessControlSnapshot | null>(null);
  const [pendingInvites, setPendingInvites] = useState<WorkspaceInvite[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("members");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("MEMBER");
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [isResendingInviteId, setIsResendingInviteId] = useState<string | null>(null);
  const [isRevokingInviteId, setIsRevokingInviteId] = useState<string | null>(null);
  const [isSavingModuleEntitlements, setIsSavingModuleEntitlements] = useState(false);

  const [editingMember, setEditingMember] = useState<WorkspaceAccessControlMember | null>(null);
  const [editingGroup, setEditingGroup] = useState<WorkspaceAccessGroup | "new" | null>(null);
  const [isDeletingGroupId, setIsDeletingGroupId] = useState<string | null>(null);

  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setIsLoadingWorkspaceInfo(true);
    workspaceService.listWorkspaces().then(workspaces => {
      if (!mounted) return;
      const current = workspaces.find(w => w.slug === workspaceSlug);
      setIsCorporateWorkspace(current?.kind === "CORPORATE");
    }).catch(() => {
      if (mounted) setIsCorporateWorkspace(false);
    }).finally(() => {
      if (mounted) setIsLoadingWorkspaceInfo(false);
    });
    return () => { mounted = false; };
  }, [workspaceSlug]);

  useEffect(() => {
    if (!isCorporateWorkspace || !workspaceSlug) {
      setAccessControl(null);
      return;
    }
    let mounted = true;
    setIsLoadingAccessControl(true);
    workspaceService.getAccessControl(workspaceSlug).then(result => {
      if (mounted) setAccessControl(result);
    }).catch(() => {
      if (mounted) setError("Não foi possível carregar roles e permissões.");
    }).finally(() => {
      if (mounted) setIsLoadingAccessControl(false);
    });
    return () => { mounted = false; };
  }, [isCorporateWorkspace, workspaceSlug]);

  useEffect(() => {
    if (!isCorporateWorkspace || !workspaceSlug) {
      setPendingInvites([]);
      return;
    }
    let mounted = true;
    setIsLoadingInvites(true);
    workspaceService.listWorkspaceInvites(workspaceSlug).then(invites => {
      if (mounted) setPendingInvites(invites.filter(i => i.status === "PENDING"));
    }).catch(() => {
      if (mounted) setError("Não foi possível carregar os convites pendentes.");
    }).finally(() => {
      if (mounted) setIsLoadingInvites(false);
    });
    return () => { mounted = false; };
  }, [isCorporateWorkspace, workspaceSlug]);

  const refreshAccessControl = async () => {
    const result = await workspaceService.getAccessControl(workspaceSlug);
    setAccessControl(result);
  };

  const refreshInvites = async () => {
    const invites = await workspaceService.listWorkspaceInvites(workspaceSlug);
    setPendingInvites(invites.filter(i => i.status === "PENDING"));
  };

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setError("");
    setTimeout(() => setFeedback(""), 4000);
  };

  const showError = (msg: string) => {
    setError(msg);
    setFeedback("");
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      showError("Informe um e-mail válido.");
      return;
    }
    if (pendingInvites.some(i => i.email === email && i.status === "PENDING")) {
      showError("Este e-mail já possui um convite pendente.");
      return;
    }
    setIsSubmittingInvite(true);
    setError("");
    try {
      await workspaceService.createWorkspaceInvite(workspaceSlug, {
        email,
        role: inviteRole === "OWNER" ? "ADMIN" : inviteRole,
      });
      await refreshInvites();
      setInviteEmail("");
      setInviteRole("MEMBER");
      showFeedback("Convite enviado com sucesso.");
    } catch {
      showError("Não foi possível enviar o convite.");
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    setIsResendingInviteId(inviteId);
    setError("");
    try {
      await workspaceService.resendWorkspaceInvite(workspaceSlug, inviteId);
      await refreshInvites();
      showFeedback("Convite reenviado.");
    } catch {
      showError("Não foi possível reenviar o convite.");
    } finally {
      setIsResendingInviteId(null);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setIsRevokingInviteId(inviteId);
    setError("");
    try {
      await workspaceService.revokeWorkspaceInvite(workspaceSlug, inviteId);
      await refreshInvites();
      showFeedback("Convite removido.");
    } catch {
      showError("Não foi possível remover o convite.");
    } finally {
      setIsRevokingInviteId(null);
    }
  };

  const handleToggleModule = async (moduleKey: WorkspaceModuleKey, enabled: boolean) => {
    setIsSavingModuleEntitlements(true);
    setError("");
    try {
      const current = accessControl?.moduleEntitlements ?? {};
      await workspaceService.updateWorkspaceModuleEntitlements(workspaceSlug, {
        ...current,
        [moduleKey]: enabled,
      });
      await refreshAccessControl();
      showFeedback("Módulos atualizados.");
    } catch {
      showError("Não foi possível atualizar os módulos.");
    } finally {
      setIsSavingModuleEntitlements(false);
    }
  };

  const handleSaveMemberAccess = async (userId: string, draft: MemberEditorDraft) => {
    await workspaceService.updateMemberAccessControl(workspaceSlug, userId, {
      role: draft.role,
      permissions: {
        allow: draft.allowOverrides,
        deny: draft.denyOverrides,
        groupIds: draft.groupIds,
        allowedModules: draft.allowedModules,
        allowedBoardViewKeys: splitKeys(draft.boardViewKeys),
        ownCardsOnly: draft.ownCardsOnly,
      },
    });
    await refreshAccessControl();
    setEditingMember(null);
    showFeedback("Acesso do membro atualizado.");
  };

  const handleSaveGroup = async (draft: GroupDraft) => {
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      allow: draft.allow,
      deny: draft.deny,
      allowedModules: draft.allowedModules,
      allowedBoardViewKeys: splitKeys(draft.boardViewKeys),
      ownCardsOnly: draft.ownCardsOnly,
    };
    if (editingGroup && editingGroup !== "new") {
      await workspaceService.updateWorkspaceAccessGroup(workspaceSlug, editingGroup.id, payload);
    } else {
      await workspaceService.createWorkspaceAccessGroup(workspaceSlug, payload);
    }
    await refreshAccessControl();
    setEditingGroup(null);
    showFeedback(editingGroup !== "new" ? "Grupo atualizado." : "Grupo criado.");
  };

  const handleDeleteGroup = async (groupId: string) => {
    setIsDeletingGroupId(groupId);
    setError("");
    try {
      await workspaceService.deleteWorkspaceAccessGroup(workspaceSlug, groupId);
      await refreshAccessControl();
      showFeedback("Grupo removido.");
    } catch {
      showError("Não foi possível remover o grupo.");
    } finally {
      setIsDeletingGroupId(null);
    }
  };

  const membersFromSnapshot = useMemo(
    () => Object.values(snapshot?.membersById ?? {}),
    [snapshot?.membersById]
  );

  const members: WorkspaceAccessControlMember[] = accessControl?.members ?? membersFromSnapshot.map(m => ({
    userId: m.id,
    name: m.name,
    email: "",
    role: (m.role ?? "MEMBER") as WorkspaceRole,
    overrides: { allow: [], deny: [], groupIds: [], allowedModules: [], allowedBoardViewKeys: [], ownCardsOnly: false },
    effectivePermissions: [],
  }));

  const groups = accessControl?.groups ?? [];
  const moduleCatalog = accessControl?.moduleCatalog ?? MODULE_KEYS;
  const catalog = accessControl?.catalog ?? [];

  if (isLoadingWorkspaceInfo) {
    return (
      <div className="ms">
        <Section title="Pessoas e acesso" subtitle="Carregando configurações do workspace...">
          <p className="ms-hint">Aguarde enquanto carregamos os dados.</p>
        </Section>
      </div>
    );
  }

  if (!isCorporateWorkspace) {
    return (
      <div className="ms">
        <Section
          title="Pessoas e acesso"
          subtitle="Convites, roles e permissões disponíveis apenas em workspaces corporativos."
        >
          <p className="ms-hint">
            Este workspace é pessoal e já está configurado para uso individual.
          </p>
        </Section>
      </div>
    );
  }

  const activeModulesCount = moduleCatalog.filter(
    m => accessControl?.moduleEntitlements?.[m] !== false
  ).length;

  return (
    <div className="ms">
      {/* Overview metrics */}
      <div className="ms-overview">
        <MetricCard label="Membros" value={members.length} />
        <MetricCard label="Convites pendentes" value={pendingInvites.length} />
        <MetricCard label="Módulos ativos" value={activeModulesCount} />
        <MetricCard label="Grupos de acesso" value={groups.length} />
      </div>

      {/* Feedback bar */}
      {(feedback || error) && (
        <div className="ms-feedback-bar">
          {feedback && <span className="ms-feedback-bar__ok">{feedback}</span>}
          {error && <span className="ms-feedback-bar__err">{error}</span>}
        </div>
      )}

      {/* Tab navigation */}
      <Tabs value={activeTab} items={TAB_ITEMS} onChange={setActiveTab} />

      {/* ── Membros ── */}
      {activeTab === "members" && (
        <Section
          title="Membros"
          subtitle="Gerencie o acesso de cada pessoa no workspace."
          className="ms-section"
        >
          {isLoadingAccessControl ? (
            <p className="ms-hint">Carregando membros...</p>
          ) : members.length === 0 ? (
            <p className="ms-hint">Nenhum membro encontrado.</p>
          ) : (
            <div className="ms-member-list">
              {members.map(member => {
                const isOwner = member.role === "OWNER";
                const editableMember = accessControl?.members.find(m => m.userId === member.userId) ?? null;
                const groupCount = (member.overrides.groupIds ?? []).length;
                const moduleCount = (member.overrides.allowedModules ?? []).length;

                return (
                  <div key={member.userId} className="ms-member-row">
                    <UserAvatar
                      alt={member.name}
                      initials={getInitials(member.name)}
                      size="sm"
                    />
                    <div className="ms-member-row__info">
                      <strong>{member.name}</strong>
                      <span>{member.email || "Sem e-mail visível"}</span>
                    </div>
                    <div className="ms-member-row__meta">
                      <StatusBadge tone={ROLE_TONES[member.role] ?? "default"}>
                        {ROLE_LABELS[member.role] ?? member.role}
                      </StatusBadge>
                      {groupCount > 0 && (
                        <span className="ms-badge ms-badge--blue">
                          {groupCount} grupo{groupCount !== 1 ? "s" : ""}
                        </span>
                      )}
                      {moduleCount > 0 && (
                        <span className="ms-badge">
                          {moduleCount} módulo{moduleCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => editableMember && setEditingMember(editableMember)}
                      disabled={isOwner || !editableMember}
                    >
                      {isOwner ? "Proprietário" : "Editar acesso"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      )}

      {/* ── Convites ── */}
      {activeTab === "invites" && (
        <Section
          title="Convites"
          subtitle="Adicione novos membros e gerencie convites enviados."
          className="ms-section"
        >
          <div className="ms-invite-form">
            <FormField label="E-mail">
              <TextInput
                value={inviteEmail}
                placeholder="nome@empresa.com"
                onChange={e => setInviteEmail(e.target.value)}
              />
            </FormField>
            <FormField label="Role inicial">
              <div className="ms-role-row">
                {ASSIGNABLE_ROLES.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    className={`ms-role-chip${inviteRole === r.value ? " ms-role-chip--active" : ""}`}
                    onClick={() => setInviteRole(r.value)}
                    disabled={isSubmittingInvite}
                    title={r.description}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </FormField>
            <div className="ms-invite-form__action">
              <Button
                type="button"
                onClick={() => void handleInvite()}
                disabled={isSubmittingInvite}
              >
                {isSubmittingInvite ? "Enviando..." : "Enviar convite"}
              </Button>
            </div>
          </div>

          <div className="ms-invite-list">
            {isLoadingInvites ? (
              <p className="ms-hint">Carregando convites...</p>
            ) : pendingInvites.length === 0 ? (
              <p className="ms-hint">Nenhum convite pendente no momento.</p>
            ) : (
              <>
                <p className="ms-section-label">
                  Convites pendentes ({pendingInvites.length})
                </p>
                {pendingInvites.map(invite => (
                  <div key={invite.id} className="ms-invite-row">
                    <div className="ms-invite-row__avatar">
                      {invite.email[0].toUpperCase()}
                    </div>
                    <div className="ms-invite-row__info">
                      <strong>{invite.email}</strong>
                      <span>Enviado em {formatDate(invite.sentAt)}</span>
                    </div>
                    <StatusBadge tone={ROLE_TONES[invite.role] ?? "default"}>
                      {ROLE_LABELS[invite.role] ?? invite.role}
                    </StatusBadge>
                    <div className="ms-invite-row__actions">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void handleResendInvite(invite.id)}
                        disabled={
                          isResendingInviteId === invite.id ||
                          isRevokingInviteId === invite.id
                        }
                      >
                        {isResendingInviteId === invite.id ? "Reenviando..." : "Reenviar"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void handleRevokeInvite(invite.id)}
                        disabled={
                          isResendingInviteId === invite.id ||
                          isRevokingInviteId === invite.id
                        }
                      >
                        {isRevokingInviteId === invite.id ? "Removendo..." : "Remover"}
                      </Button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </Section>
      )}

      {/* ── Módulos ── */}
      {activeTab === "modules" && (
        <Section
          title="Módulos do workspace"
          subtitle="Controle quais módulos estão habilitados no plano atual."
          className="ms-section"
        >
          {isSavingModuleEntitlements && (
            <p className="ms-hint">Salvando...</p>
          )}
          <div className="ms-module-grid">
            {moduleCatalog.map(moduleKey => {
              const meta = MODULE_META[moduleKey];
              const enabled = accessControl?.moduleEntitlements?.[moduleKey] !== false;
              return (
                <div
                  key={moduleKey}
                  className={`ms-module-card${enabled ? " ms-module-card--enabled" : ""}`}
                >
                  <div className="ms-module-card__head">
                    <div className="ms-module-card__info">
                      <strong>{meta.label}</strong>
                      <span>{meta.description}</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      className={`ms-toggle${enabled ? " ms-toggle--on" : ""}`}
                      onClick={() => void handleToggleModule(moduleKey, !enabled)}
                      disabled={isSavingModuleEntitlements}
                      aria-label={`${enabled ? "Desabilitar" : "Habilitar"} ${meta.label}`}
                    >
                      <span className="ms-toggle__knob" />
                    </button>
                  </div>
                  <div className="ms-module-card__status">
                    <span className={`ms-status-dot${enabled ? " ms-status-dot--on" : ""}`} />
                    {enabled ? "Habilitado" : "Desabilitado"}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Grupos ── */}
      {activeTab === "groups" && (
        <Section
          title="Grupos de acesso"
          subtitle="Conjuntos reutilizáveis de permissões para aplicar a múltiplos membros."
          className="ms-section"
        >
          <div className="ms-section-top-action">
            <Button type="button" onClick={() => setEditingGroup("new")}>
              Criar grupo
            </Button>
          </div>
          {groups.length === 0 ? (
            <p className="ms-hint">Nenhum grupo de acesso criado ainda.</p>
          ) : (
            <div className="ms-group-list">
              {groups.map(group => (
                <div key={group.id} className="ms-group-card">
                  <div className="ms-group-card__head">
                    <div className="ms-group-card__info">
                      <strong>{group.name}</strong>
                      {group.description && <span>{group.description}</span>}
                    </div>
                    <div className="ms-group-card__actions">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingGroup(group)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void handleDeleteGroup(group.id)}
                        disabled={isDeletingGroupId === group.id}
                      >
                        {isDeletingGroupId === group.id ? "Removendo..." : "Remover"}
                      </Button>
                    </div>
                  </div>
                  <div className="ms-group-card__preview">
                    {(group.allow ?? []).length > 0 && (
                      <div className="ms-chips ms-chips--sm">
                        <span className="ms-perm-source__label">Permite:</span>
                        {(group.allow ?? []).slice(0, 4).map(p => (
                          <span key={p} className="ms-chip ms-chip--allow">{p}</span>
                        ))}
                        {(group.allow ?? []).length > 4 && (
                          <span className="ms-chip ms-chip--more">
                            +{(group.allow ?? []).length - 4}
                          </span>
                        )}
                      </div>
                    )}
                    {(group.deny ?? []).length > 0 && (
                      <div className="ms-chips ms-chips--sm">
                        <span className="ms-perm-source__label">Bloqueia:</span>
                        {(group.deny ?? []).slice(0, 4).map(p => (
                          <span key={p} className="ms-chip ms-chip--deny">{p}</span>
                        ))}
                        {(group.deny ?? []).length > 4 && (
                          <span className="ms-chip ms-chip--more">
                            +{(group.deny ?? []).length - 4}
                          </span>
                        )}
                      </div>
                    )}
                    {(group.allowedModules ?? []).length > 0 && (
                      <div className="ms-chips ms-chips--sm">
                        {(group.allowedModules ?? []).map(m => (
                          <span key={m} className="ms-chip ms-chip--module">
                            {MODULE_META[m]?.label ?? m}
                          </span>
                        ))}
                      </div>
                    )}
                    {(group.allow ?? []).length === 0 &&
                      (group.deny ?? []).length === 0 &&
                      (group.allowedModules ?? []).length === 0 && (
                        <span className="ms-hint">Sem restrições configuradas.</span>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── Matriz ── */}
      {activeTab === "matrix" && (
        <Section
          title="Matriz de permissões"
          subtitle="Catálogo completo de permissões por role."
          className="ms-section"
        >
          {!accessControl ? (
            <p className="ms-hint">Matriz indisponível no momento.</p>
          ) : (
            <PermissionsMatrix accessControl={accessControl} />
          )}
        </Section>
      )}

      {/* Member editor modal */}
      {editingMember && accessControl && (
        <MemberAccessEditorDrawer
          member={editingMember}
          accessControl={accessControl}
          onSave={handleSaveMemberAccess}
          onClose={() => setEditingMember(null)}
        />
      )}

      {/* Group editor modal */}
      {editingGroup && (
        <AccessGroupEditorDrawer
          catalog={catalog}
          group={editingGroup === "new" ? undefined : editingGroup}
          onSave={handleSaveGroup}
          onClose={() => setEditingGroup(null)}
        />
      )}
    </div>
  );
}
