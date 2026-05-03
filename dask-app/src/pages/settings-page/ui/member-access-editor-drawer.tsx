import { useMemo, useState } from "react";
import type {
  WorkspaceAccessControlMember,
  WorkspaceAccessControlSnapshot,
  WorkspacePermissionKey
} from "@/modules/workspace/model";
import { Button, DrawerShell, FormField, TextInput, UserAvatar } from "@/shared/ui";
import { GroupPicker } from "./group-picker";
import { ModulePicker } from "./module-picker";
import { PermissionPicker } from "./permission-picker";
import type { MemberEditorDraft, WorkspaceRole } from "./members-settings.model";
import { ASSIGNABLE_ROLES, getInitials, MODULE_META, ROLE_LABELS } from "./members-settings.model";

type MemberEditorSection = "role" | "groups" | "allow" | "deny" | "modules" | "summary";

export function MemberAccessEditorDrawer({
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

  const drawerNav = (
    <>
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
    </>
  );

  const drawerFooter = (
    <>
      <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
        Cancelar
      </Button>
      {!isOwner && (
        <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
          {isSaving ? "Salvando..." : "Salvar acesso"}
        </Button>
      )}
    </>
  );

  return (
    <DrawerShell
      title={member.name}
      titleId="member-editor-title"
      subtitle={member.email || "Sem e-mail visível"}
      leading={<UserAvatar alt={member.name} initials={getInitials(member.name)} size="md" />}
      onClose={onClose}
      shellClassName="ms-drawer"
      headerClassName="ms-drawer__header"
      titleWrapperClassName="ms-drawer__header-info"
      closeButtonClassName="ms-drawer__close"
      closeButtonContent="×"
      afterHeader={isOwner ? (
        <div className="ms-drawer__owner-banner">
          Proprietário do workspace — acesso total, não editável.
        </div>
      ) : null}
      nav={drawerNav}
      navClassName="ms-drawer__nav"
      bodyClassName="ms-drawer__body"
      error={error}
      errorClassName="ms-drawer__error"
      footer={drawerFooter}
      footerClassName="ms-drawer__footer"
    >
        {section === "role" && (
          <div className="ms-drawer__section">
            <p className="ms-drawer__section-hint">Define o nível base de acesso deste membro.</p>
            <div className="ms-role-selector">
              {(["OWNER", "ADMIN", "MEMBER", "VIEWER", "CLIENT"] as WorkspaceRole[]).map(role => (
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
                placeholder="kanban, list, agenda..."
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
    </DrawerShell>
  );
}


