import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { workspaceService } from "@/modules/workspace/api";
import { useWorkspace } from "@/modules/workspace";
import type { WorkspaceAccessControlSnapshot, WorkspacePermissionKey } from "@/modules/workspace/model";
import { Button, FormField, Section, Select, TextInput, Textarea } from "@/shared/ui";
import "./members-settings.css";

type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

interface PendingInvite {
  id: string;
  email: string;
  role: WorkspaceRole;
  createdAt: string;
}

const ASSIGNABLE_ROLE_OPTIONS: Array<{ value: WorkspaceRole; label: string }> = [
  { value: "ADMIN", label: "Admin" },
  { value: "MEMBER", label: "Member" },
  { value: "VIEWER", label: "Viewer" }
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parsePermissionList(input: string): WorkspacePermissionKey[] {
  const values = input
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  return Array.from(new Set(values)) as WorkspacePermissionKey[];
}

export function MembersSettings() {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const { snapshot } = useWorkspace();

  const [isCorporateWorkspace, setIsCorporateWorkspace] = useState(false);
  const [isLoadingWorkspaceInfo, setIsLoadingWorkspaceInfo] = useState(true);
  const [isLoadingAccessControl, setIsLoadingAccessControl] = useState(false);
  const [accessControl, setAccessControl] = useState<WorkspaceAccessControlSnapshot | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("MEMBER");
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);

  const [roleDraftByUserId, setRoleDraftByUserId] = useState<Record<string, WorkspaceRole>>({});
  const [allowDraftByUserId, setAllowDraftByUserId] = useState<Record<string, string>>({});
  const [denyDraftByUserId, setDenyDraftByUserId] = useState<Record<string, string>>({});
  const [isSavingByUserId, setIsSavingByUserId] = useState<Record<string, boolean>>({});

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
    if (!accessControl) {
      setRoleDraftByUserId({});
      setAllowDraftByUserId({});
      setDenyDraftByUserId({});
      return;
    }

    const nextRoleDraft: Record<string, WorkspaceRole> = {};
    const nextAllowDraft: Record<string, string> = {};
    const nextDenyDraft: Record<string, string> = {};

    accessControl.members.forEach(member => {
      nextRoleDraft[member.userId] = member.role;
      nextAllowDraft[member.userId] = member.overrides.allow.join(", ");
      nextDenyDraft[member.userId] = member.overrides.deny.join(", ");
    });

    setRoleDraftByUserId(nextRoleDraft);
    setAllowDraftByUserId(nextAllowDraft);
    setDenyDraftByUserId(nextDenyDraft);
  }, [accessControl]);

  const membersFromSnapshot = useMemo(() => Object.values(snapshot?.membersById ?? {}), [snapshot?.membersById]);

  const members = accessControl?.members ?? membersFromSnapshot.map(member => ({
    userId: member.id,
    name: member.name,
    email: "",
    role: member.role ?? "MEMBER",
    overrides: { allow: [], deny: [] },
    effectivePermissions: []
  }));

  const handleInvite = () => {
    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError("Informe um e-mail valido para enviar o convite.");
      setFeedback("");
      return;
    }

    if (pendingInvites.some(invite => invite.email === normalizedEmail)) {
      setError("Este e-mail ja possui um convite pendente.");
      setFeedback("");
      return;
    }

    const newInvite: PendingInvite = {
      id: `${Date.now()}`,
      email: normalizedEmail,
      role: inviteRole,
      createdAt: new Date().toISOString()
    };

    setPendingInvites(current => [newInvite, ...current]);
    setInviteEmail("");
    setInviteRole("MEMBER");
    setError("");
    setFeedback("Convite preparado. Na proxima etapa conectamos com envio de e-mail real.");
  };

  const handleRevokeInvite = (inviteId: string) => {
    setPendingInvites(current => current.filter(invite => invite.id !== inviteId));
    setFeedback("Convite pendente removido.");
    setError("");
  };

  const handleApplyAccessControl = async (memberUserId: string) => {
    if (!workspaceSlug) {
      return;
    }

    const role = roleDraftByUserId[memberUserId];
    const allow = parsePermissionList(allowDraftByUserId[memberUserId] ?? "");
    const deny = parsePermissionList(denyDraftByUserId[memberUserId] ?? "");

    setIsSavingByUserId(current => ({ ...current, [memberUserId]: true }));
    setFeedback("");
    setError("");

    try {
      await workspaceService.updateMemberAccessControl(workspaceSlug, memberUserId, {
        role,
        permissions: {
          allow,
          deny
        }
      });

      const refreshed = await workspaceService.getAccessControl(workspaceSlug);
      setAccessControl(refreshed);
      setFeedback("Role e permissoes atualizadas com sucesso.");
    } catch {
      setError("Nao foi possivel salvar o acesso deste membro.");
    } finally {
      setIsSavingByUserId(current => ({ ...current, [memberUserId]: false }));
    }
  };

  if (isLoadingWorkspaceInfo) {
    return (
      <div className="members-settings">
        <Section title="Pessoas e acesso" subtitle="Carregando configuracoes do workspace..." />
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
          <Button type="button" onClick={handleInvite}>
            Adicionar convite
          </Button>
          {feedback ? <span className="members-settings__feedback">{feedback}</span> : null}
          {error ? <span className="members-settings__error">{error}</span> : null}
        </div>
      </Section>

      <Section
        title="Convites pendentes"
        subtitle="Base pronta para integrar envio real por e-mail."
        className="members-settings__card"
      >
        {pendingInvites.length === 0 ? (
          <p className="members-settings__hint">Nenhum convite pendente.</p>
        ) : (
          <div className="members-settings__list">
            {pendingInvites.map(invite => (
              <div key={invite.id} className="members-settings__row">
                <div className="members-settings__row-content">
                  <strong>{invite.email}</strong>
                  <span>{invite.role} - {new Date(invite.createdAt).toLocaleString()}</span>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => handleRevokeInvite(invite.id)}>
                  Remover
                </Button>
              </div>
            ))}
          </div>
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
