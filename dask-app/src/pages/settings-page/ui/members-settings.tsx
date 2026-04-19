import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { workspaceService } from "@/modules/workspace/api";
import { useWorkspace } from "@/modules/workspace";
import type {
  WorkspaceAccessControlSnapshot,
  WorkspaceInvite,
  WorkspaceModuleKey,
  WorkspacePermissionKey
} from "@/modules/workspace/model";
import { Button, FormField, Section, Select, TextInput, Textarea } from "@/shared/ui";
import "./members-settings.css";

type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

const ASSIGNABLE_ROLE_OPTIONS: Array<{ value: WorkspaceRole; label: string }> = [
  { value: "ADMIN", label: "Admin" },
  { value: "MEMBER", label: "Member" },
  { value: "VIEWER", label: "Viewer" }
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MODULE_KEYS: WorkspaceModuleKey[] = ["board", "automation", "documentation", "ai", "settings", "fiscal", "leads", "marketing"];

function parsePermissionList(input: string): WorkspacePermissionKey[] {
  const values = input
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  return Array.from(new Set(values)) as WorkspacePermissionKey[];
}

function parseStringList(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(",")
        .map(value => value.trim())
        .filter(Boolean)
    )
  );
}

function parseModuleList(input: string): WorkspaceModuleKey[] {
  return parseStringList(input).filter((value): value is WorkspaceModuleKey =>
    MODULE_KEYS.includes(value as WorkspaceModuleKey)
  );
}

export function MembersSettings() {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const { snapshot } = useWorkspace();

  const [isCorporateWorkspace, setIsCorporateWorkspace] = useState(false);
  const [isLoadingWorkspaceInfo, setIsLoadingWorkspaceInfo] = useState(true);
  const [isLoadingAccessControl, setIsLoadingAccessControl] = useState(false);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [isResendingInviteId, setIsResendingInviteId] = useState<string | null>(null);
  const [isRevokingInviteId, setIsRevokingInviteId] = useState<string | null>(null);
  const [accessControl, setAccessControl] = useState<WorkspaceAccessControlSnapshot | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("MEMBER");
  const [pendingInvites, setPendingInvites] = useState<WorkspaceInvite[]>([]);

  const [roleDraftByUserId, setRoleDraftByUserId] = useState<Record<string, WorkspaceRole>>({});
  const [allowDraftByUserId, setAllowDraftByUserId] = useState<Record<string, string>>({});
  const [denyDraftByUserId, setDenyDraftByUserId] = useState<Record<string, string>>({});
  const [groupIdsDraftByUserId, setGroupIdsDraftByUserId] = useState<Record<string, string>>({});
  const [moduleDraftByUserId, setModuleDraftByUserId] = useState<Record<string, string>>({});
  const [boardViewDraftByUserId, setBoardViewDraftByUserId] = useState<Record<string, string>>({});
  const [ownCardsOnlyByUserId, setOwnCardsOnlyByUserId] = useState<Record<string, boolean>>({});
  const [isSavingByUserId, setIsSavingByUserId] = useState<Record<string, boolean>>({});

  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [newGroupAllow, setNewGroupAllow] = useState("");
  const [newGroupDeny, setNewGroupDeny] = useState("");
  const [newGroupModules, setNewGroupModules] = useState("board");
  const [newGroupBoardViews, setNewGroupBoardViews] = useState("");
  const [newGroupOwnCardsOnly, setNewGroupOwnCardsOnly] = useState(false);
  const [isSavingGroups, setIsSavingGroups] = useState(false);
  const [isSavingModuleEntitlements, setIsSavingModuleEntitlements] = useState(false);

  const [feedback, setFeedback] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    setIsLoadingWorkspaceInfo(true);

    workspaceService
      .listWorkspaces()
      .then(workspaces => {
        if (!mounted) {
          return;
        }

        const currentWorkspace = workspaces.find(workspace => workspace.slug === workspaceSlug);
        setIsCorporateWorkspace(currentWorkspace?.kind === "CORPORATE");
      })
      .catch(() => {
        if (mounted) {
          setIsCorporateWorkspace(false);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoadingWorkspaceInfo(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [workspaceSlug]);

  useEffect(() => {
    if (!isCorporateWorkspace || !workspaceSlug) {
      setAccessControl(null);
      return;
    }

    let mounted = true;
    setIsLoadingAccessControl(true);

    workspaceService
      .getAccessControl(workspaceSlug)
      .then(result => {
        if (!mounted) {
          return;
        }
        setAccessControl(result);
      })
      .catch(() => {
        if (mounted) {
          setError("Nao foi possivel carregar roles e permissoes deste workspace.");
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoadingAccessControl(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [isCorporateWorkspace, workspaceSlug]);

  useEffect(() => {
    if (!isCorporateWorkspace || !workspaceSlug) {
      setPendingInvites([]);
      return;
    }

    let mounted = true;
    setIsLoadingInvites(true);

    workspaceService
      .listWorkspaceInvites(workspaceSlug)
      .then((invites) => {
        if (!mounted) {
          return;
        }
        setPendingInvites(invites.filter((invite) => invite.status === "PENDING"));
      })
      .catch(() => {
        if (mounted) {
          setError("Nao foi possivel carregar os convites pendentes.");
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoadingInvites(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [isCorporateWorkspace, workspaceSlug]);

  useEffect(() => {
    if (!accessControl) {
      setRoleDraftByUserId({});
      setAllowDraftByUserId({});
      setDenyDraftByUserId({});
      setGroupIdsDraftByUserId({});
      setModuleDraftByUserId({});
      setBoardViewDraftByUserId({});
      setOwnCardsOnlyByUserId({});
      return;
    }

    const nextRoleDraft: Record<string, WorkspaceRole> = {};
    const nextAllowDraft: Record<string, string> = {};
    const nextDenyDraft: Record<string, string> = {};
    const nextGroupIdsDraft: Record<string, string> = {};
    const nextModulesDraft: Record<string, string> = {};
    const nextBoardViewDraft: Record<string, string> = {};
    const nextOwnCardsOnly: Record<string, boolean> = {};

    accessControl.members.forEach(member => {
      nextRoleDraft[member.userId] = member.role;
      nextAllowDraft[member.userId] = member.overrides.allow.join(", ");
      nextDenyDraft[member.userId] = member.overrides.deny.join(", ");
      nextGroupIdsDraft[member.userId] = (member.overrides.groupIds ?? []).join(", ");
      nextModulesDraft[member.userId] = (member.overrides.allowedModules ?? []).join(", ");
      nextBoardViewDraft[member.userId] = (member.overrides.allowedBoardViewKeys ?? []).join(", ");
      nextOwnCardsOnly[member.userId] = member.overrides.ownCardsOnly === true;
    });

    setRoleDraftByUserId(nextRoleDraft);
    setAllowDraftByUserId(nextAllowDraft);
    setDenyDraftByUserId(nextDenyDraft);
    setGroupIdsDraftByUserId(nextGroupIdsDraft);
    setModuleDraftByUserId(nextModulesDraft);
    setBoardViewDraftByUserId(nextBoardViewDraft);
    setOwnCardsOnlyByUserId(nextOwnCardsOnly);
  }, [accessControl]);

  const membersFromSnapshot = useMemo(() => Object.values(snapshot?.membersById ?? {}), [snapshot?.membersById]);

  const members = accessControl?.members ?? membersFromSnapshot.map(member => ({
    userId: member.id,
    name: member.name,
    email: "",
    role: member.role ?? "MEMBER",
    overrides: {
      allow: [],
      deny: [],
      groupIds: [],
      allowedModules: [],
      allowedBoardViewKeys: [],
      ownCardsOnly: false
    },
    effectivePermissions: []
  }));

  const refreshAccessControl = async () => {
    const refreshed = await workspaceService.getAccessControl(workspaceSlug);
    setAccessControl(refreshed);
  };

  const refreshPendingInvites = async () => {
    const invites = await workspaceService.listWorkspaceInvites(workspaceSlug);
    setPendingInvites(invites.filter((invite) => invite.status === "PENDING"));
  };

  const handleInvite = async () => {
    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError("Informe um e-mail valido para enviar o convite.");
      setFeedback("");
      return;
    }

    if (pendingInvites.some(invite => invite.email === normalizedEmail && invite.status === "PENDING")) {
      setError("Este e-mail ja possui um convite pendente.");
      setFeedback("");
      return;
    }

    setIsSubmittingInvite(true);
    setError("");
    setFeedback("");

    try {
      await workspaceService.createWorkspaceInvite(workspaceSlug, {
        email: normalizedEmail,
        role: inviteRole === "OWNER" ? "ADMIN" : inviteRole
      });
      await refreshPendingInvites();
      setInviteEmail("");
      setInviteRole("MEMBER");
      setFeedback("Convite enviado por e-mail.");
    } catch {
      setError("Nao foi possivel enviar o convite agora.");
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    setIsResendingInviteId(inviteId);
    setFeedback("");
    setError("");

    try {
      await workspaceService.resendWorkspaceInvite(workspaceSlug, inviteId);
      await refreshPendingInvites();
      setFeedback("Convite reenviado por e-mail.");
    } catch {
      setError("Nao foi possivel reenviar o convite.");
    } finally {
      setIsResendingInviteId(null);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setIsRevokingInviteId(inviteId);
    setFeedback("");
    setError("");

    try {
      await workspaceService.revokeWorkspaceInvite(workspaceSlug, inviteId);
      await refreshPendingInvites();
      setFeedback("Convite pendente removido.");
    } catch {
      setError("Nao foi possivel remover o convite.");
    } finally {
      setIsRevokingInviteId(null);
    }
  };

  const handleApplyAccessControl = async (memberUserId: string) => {
    if (!workspaceSlug) {
      return;
    }

    const role = roleDraftByUserId[memberUserId];
    const allow = parsePermissionList(allowDraftByUserId[memberUserId] ?? "");
    const deny = parsePermissionList(denyDraftByUserId[memberUserId] ?? "");
    const groupIds = parseStringList(groupIdsDraftByUserId[memberUserId] ?? "");
    const allowedModules = parseModuleList(moduleDraftByUserId[memberUserId] ?? "");
    const allowedBoardViewKeys = parseStringList(boardViewDraftByUserId[memberUserId] ?? "");
    const ownCardsOnly = ownCardsOnlyByUserId[memberUserId] === true;

    setIsSavingByUserId(current => ({ ...current, [memberUserId]: true }));
    setFeedback("");
    setError("");

    try {
      await workspaceService.updateMemberAccessControl(workspaceSlug, memberUserId, {
        role,
        permissions: {
          allow,
          deny,
          groupIds,
          allowedModules,
          allowedBoardViewKeys,
          ownCardsOnly
        }
      });

      await refreshAccessControl();
      setFeedback("Role e permissoes atualizadas com sucesso.");
    } catch {
      setError("Nao foi possivel salvar o acesso deste membro.");
    } finally {
      setIsSavingByUserId(current => ({ ...current, [memberUserId]: false }));
    }
  };

  const handleCreateAccessGroup = async () => {
    if (!newGroupName.trim()) {
      setError("Informe um nome para o grupo de acesso.");
      setFeedback("");
      return;
    }

    setIsSavingGroups(true);
    setError("");
    setFeedback("");

    try {
      await workspaceService.createWorkspaceAccessGroup(workspaceSlug, {
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || undefined,
        allow: parsePermissionList(newGroupAllow),
        deny: parsePermissionList(newGroupDeny),
        allowedModules: parseModuleList(newGroupModules),
        allowedBoardViewKeys: parseStringList(newGroupBoardViews),
        ownCardsOnly: newGroupOwnCardsOnly
      });
      await refreshAccessControl();
      setNewGroupName("");
      setNewGroupDescription("");
      setNewGroupAllow("");
      setNewGroupDeny("");
      setNewGroupModules("board");
      setNewGroupBoardViews("");
      setNewGroupOwnCardsOnly(false);
      setFeedback("Grupo de acesso criado com sucesso.");
    } catch {
      setError("Nao foi possivel criar o grupo de acesso.");
    } finally {
      setIsSavingGroups(false);
    }
  };

  const handleDeleteAccessGroup = async (groupId: string) => {
    setIsSavingGroups(true);
    setError("");
    setFeedback("");
    try {
      await workspaceService.deleteWorkspaceAccessGroup(workspaceSlug, groupId);
      await refreshAccessControl();
      setFeedback("Grupo removido com sucesso.");
    } catch {
      setError("Nao foi possivel remover o grupo.");
    } finally {
      setIsSavingGroups(false);
    }
  };

  const handleToggleModuleEntitlement = async (moduleKey: WorkspaceModuleKey, enabled: boolean) => {
    setIsSavingModuleEntitlements(true);
    setError("");
    setFeedback("");
    try {
      const current = accessControl?.moduleEntitlements ?? {};
      await workspaceService.updateWorkspaceModuleEntitlements(workspaceSlug, {
        ...current,
        [moduleKey]: enabled
      });
      await refreshAccessControl();
      setFeedback("Modulos atualizados com sucesso.");
    } catch {
      setError("Nao foi possivel atualizar os modulos do workspace.");
    } finally {
      setIsSavingModuleEntitlements(false);
    }
  };

  if (isLoadingWorkspaceInfo) {
    return (
      <div className="members-settings">
        <Section title="Pessoas e acesso" subtitle="Carregando configuracoes do workspace...">
          <p className="members-settings__hint">Aguarde enquanto carregamos os dados.</p>
        </Section>
      </div>
    );
  }

  if (!isCorporateWorkspace) {
    return (
      <div className="members-settings">
        <Section
          title="Pessoas e acesso"
          subtitle="Convites, roles e permissoes ficam disponiveis apenas em workspaces corporativos."
          className="members-settings__card"
        >
          <p className="members-settings__hint">
            Este workspace e pessoal e ja esta configurado para uso individual.
          </p>
        </Section>
      </div>
    );
  }

  return (
    <div className="members-settings">
      <Section
        title="Convidar pessoas"
        subtitle="Adicione novos membros ao workspace corporativo e defina a role inicial."
        className="members-settings__card"
      >
        <div className="members-settings__invite-grid">
          <FormField label="E-mail">
            <TextInput
              value={inviteEmail}
              placeholder="nome@empresa.com"
              onChange={event => setInviteEmail(event.target.value)}
            />
          </FormField>

          <FormField label="Role inicial">
            <Select
              value={inviteRole}
              onChange={event => setInviteRole(event.target.value as WorkspaceRole)}
            >
              {ASSIGNABLE_ROLE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="members-settings__actions">
          <Button type="button" onClick={() => void handleInvite()} disabled={isSubmittingInvite}>
            {isSubmittingInvite ? "Enviando..." : "Enviar convite"}
          </Button>
          {feedback ? <span className="members-settings__feedback">{feedback}</span> : null}
          {error ? <span className="members-settings__error">{error}</span> : null}
        </div>
      </Section>

      <Section
        title="Convites pendentes"
        subtitle="Convites ativos enviados por e-mail."
        className="members-settings__card"
      >
        {isLoadingInvites ? <p className="members-settings__hint">Carregando convites...</p> : null}

        {!isLoadingInvites && pendingInvites.length === 0 ? (
          <p className="members-settings__hint">Nenhum convite pendente.</p>
        ) : (
          <div className="members-settings__list">
            {pendingInvites.map(invite => (
              <div key={invite.id} className="members-settings__row">
                <div className="members-settings__row-content">
                  <strong>{invite.email}</strong>
                  <span>{invite.role} - enviado em {new Date(invite.sentAt).toLocaleString()}</span>
                </div>
                <div className="members-settings__row-actions">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleResendInvite(invite.id)}
                    disabled={isResendingInviteId === invite.id || isRevokingInviteId === invite.id}
                  >
                    {isResendingInviteId === invite.id ? "Reenviando..." : "Reenviar"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleRevokeInvite(invite.id)}
                    disabled={isResendingInviteId === invite.id || isRevokingInviteId === invite.id}
                  >
                    {isRevokingInviteId === invite.id ? "Removendo..." : "Remover"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Entitlements de modulos"
        subtitle="Controle quais modulos estao habilitados neste workspace para o plano atual."
        className="members-settings__card"
      >
        <div className="members-settings__list">
          {(accessControl?.moduleCatalog ?? MODULE_KEYS).map((moduleKey) => {
            const checked = accessControl?.moduleEntitlements?.[moduleKey] !== false;
            return (
              <label key={moduleKey} className="members-settings__checkbox">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isSavingModuleEntitlements}
                  onChange={event => void handleToggleModuleEntitlement(moduleKey, event.target.checked)}
                />
                {moduleKey}
              </label>
            );
          })}
        </div>
      </Section>

      <Section
        title="Grupos de acesso custom"
        subtitle="Crie grupos reutilizaveis para restringir modulos, views e visao de cards."
        className="members-settings__card"
      >
        <div className="members-settings__invite-grid">
          <FormField label="Nome do grupo">
            <TextInput value={newGroupName} onChange={event => setNewGroupName(event.target.value)} />
          </FormField>
          <FormField label="Descricao">
            <TextInput value={newGroupDescription} onChange={event => setNewGroupDescription(event.target.value)} />
          </FormField>
        </div>

        <FormField label="Allow permissions (separado por virgula)">
          <Textarea value={newGroupAllow} onChange={event => setNewGroupAllow(event.target.value)} />
        </FormField>
        <FormField label="Deny permissions (separado por virgula)">
          <Textarea value={newGroupDeny} onChange={event => setNewGroupDeny(event.target.value)} />
        </FormField>
        <FormField label="Modulos permitidos (board, automation, documentation, ai, settings, fiscal, leads, marketing)">
          <Textarea value={newGroupModules} onChange={event => setNewGroupModules(event.target.value)} />
        </FormField>
        <FormField label="Views permitidas do board (keys separadas por virgula)">
          <Textarea value={newGroupBoardViews} onChange={event => setNewGroupBoardViews(event.target.value)} />
        </FormField>
        <label className="members-settings__checkbox">
          <input
            type="checkbox"
            checked={newGroupOwnCardsOnly}
            onChange={event => setNewGroupOwnCardsOnly(event.target.checked)}
          />
          Mostrar somente cards proprios
        </label>

        <div className="members-settings__actions">
          <Button type="button" onClick={() => void handleCreateAccessGroup()} disabled={isSavingGroups}>
            {isSavingGroups ? "Salvando..." : "Criar grupo"}
          </Button>
        </div>

        {accessControl?.groups?.length ? (
          <div className="members-settings__list">
            {accessControl.groups.map((group) => (
              <div key={group.id} className="members-settings__row">
                <div className="members-settings__row-content">
                  <strong>{group.name}</strong>
                  <span>ID: {group.id}</span>
                  <span>{group.description ?? "Sem descricao"}</span>
                </div>
                <div className="members-settings__row-actions">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleDeleteAccessGroup(group.id)}
                    disabled={isSavingGroups}
                  >
                    Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="members-settings__hint">Nenhum grupo custom criado ainda.</p>
        )}
      </Section>

      <Section
        title="Membros atuais"
        subtitle="Role e overrides de permissao por pessoa."
        className="members-settings__card"
      >
        {isLoadingAccessControl ? <p className="members-settings__hint">Carregando roles e permissoes...</p> : null}

        {members.length === 0 ? (
          <p className="members-settings__hint">Nenhum membro encontrado neste workspace.</p>
        ) : (
          <div className="members-settings__list">
            {members.map(member => {
              const selectedRole = roleDraftByUserId[member.userId] ?? member.role;
              const allowDraft = allowDraftByUserId[member.userId] ?? "";
              const denyDraft = denyDraftByUserId[member.userId] ?? "";
              const isOwner = member.role === "OWNER";
              const isSaving = isSavingByUserId[member.userId] === true;
              return (
                <div key={member.userId} className="members-settings__member-card">
                  <div className="members-settings__row-content">
                    <strong>{member.name}</strong>
                    <span>{member.email || "Sem e-mail visivel"}</span>
                    <span>Role atual: {member.role}</span>
                  </div>

                  <div className="members-settings__role-editor">
                    <FormField label="Role">
                      <Select
                        value={selectedRole}
                        onChange={event =>
                          setRoleDraftByUserId(current => ({
                            ...current,
                            [member.userId]: event.target.value as WorkspaceRole
                          }))
                        }
                        disabled={isOwner || isSaving}
                      >
                        <option value="OWNER">OWNER</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="MEMBER">MEMBER</option>
                        <option value="VIEWER">VIEWER</option>
                      </Select>
                    </FormField>

                    <FormField label="Allow overrides (separado por virgula)">
                      <Textarea
                        value={allowDraft}
                        onChange={event =>
                          setAllowDraftByUserId(current => ({
                            ...current,
                            [member.userId]: event.target.value
                          }))
                        }
                        disabled={isSaving}
                      />
                    </FormField>

                    <FormField label="Deny overrides (separado por virgula)">
                      <Textarea
                        value={denyDraft}
                        onChange={event =>
                          setDenyDraftByUserId(current => ({
                            ...current,
                            [member.userId]: event.target.value
                          }))
                        }
                        disabled={isSaving}
                      />
                    </FormField>

                    <FormField label="Grupos (ids separados por virgula)">
                      <Textarea
                        value={groupIdsDraftByUserId[member.userId] ?? ""}
                        onChange={event =>
                          setGroupIdsDraftByUserId(current => ({
                            ...current,
                            [member.userId]: event.target.value
                          }))
                        }
                        disabled={isSaving}
                      />
                    </FormField>

                    <FormField label="Modulos permitidos (board, automation, documentation, ai, settings, fiscal, leads, marketing)">
                      <Textarea
                        value={moduleDraftByUserId[member.userId] ?? ""}
                        onChange={event =>
                          setModuleDraftByUserId(current => ({
                            ...current,
                            [member.userId]: event.target.value
                          }))
                        }
                        disabled={isSaving}
                      />
                    </FormField>

                    <FormField label="Views permitidas do board (keys separadas por virgula)">
                      <Textarea
                        value={boardViewDraftByUserId[member.userId] ?? ""}
                        onChange={event =>
                          setBoardViewDraftByUserId(current => ({
                            ...current,
                            [member.userId]: event.target.value
                          }))
                        }
                        disabled={isSaving}
                      />
                    </FormField>

                    <label className="members-settings__checkbox">
                      <input
                        type="checkbox"
                        checked={ownCardsOnlyByUserId[member.userId] === true}
                        onChange={event =>
                          setOwnCardsOnlyByUserId(current => ({
                            ...current,
                            [member.userId]: event.target.checked
                          }))
                        }
                        disabled={isSaving}
                      />
                      Mostrar somente cards do proprio membro
                    </label>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleApplyAccessControl(member.userId)}
                      disabled={isSaving || isOwner}
                    >
                      {isSaving ? "Salvando..." : "Aplicar acesso"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section
        title="Matriz role x permissao"
        subtitle="Catálogo completo para controle de acesso do workspace."
        className="members-settings__card"
      >
        {!accessControl ? (
          <p className="members-settings__hint">Matriz indisponivel no momento.</p>
        ) : (
          <div className="members-settings__permissions-table">
            <div className="members-settings__permissions-header">
              <span>Permissao</span>
              <span>OWNER</span>
              <span>ADMIN</span>
              <span>MEMBER</span>
              <span>VIEWER</span>
              <span>MANAGER</span>
              <span>GUEST</span>
            </div>
            {accessControl.catalog.map(permission => (
              <div key={permission} className="members-settings__permissions-row">
                <span>{permission}</span>
                <span>{accessControl.rolePresets.OWNER.includes(permission) ? "Sim" : "Nao"}</span>
                <span>{accessControl.rolePresets.ADMIN.includes(permission) ? "Sim" : "Nao"}</span>
                <span>{accessControl.rolePresets.MEMBER.includes(permission) ? "Sim" : "Nao"}</span>
                <span>{accessControl.rolePresets.VIEWER.includes(permission) ? "Sim" : "Nao"}</span>
                <span>{accessControl.rolePresets.MANAGER.includes(permission) ? "Sim" : "Nao"}</span>
                <span>{accessControl.rolePresets.GUEST.includes(permission) ? "Sim" : "Nao"}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
