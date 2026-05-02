import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { workspaceService } from "@/modules/workspace/api";
import { useWorkspace } from "@/modules/workspace";
import type {
  WorkspaceAccessControlSnapshot,
  WorkspaceAccessGroup,
  WorkspaceAccessControlMember,
  WorkspaceInvite,
  WorkspaceModuleKey
} from "@/modules/workspace/model";
import { Tabs } from "@/shared/ui";
import { AccessGroupEditorDrawer } from "./access-group-editor-drawer";
import { AccessGroupsSection } from "./access-groups-section";
import { MemberAccessEditorDrawer } from "./member-access-editor-drawer";
import { MembersEmptyState } from "./members-empty-state";
import { MembersFeedbackBar } from "./members-feedback-bar";
import { MembersListSection } from "./members-list-section";
import { MembersOverviewSection } from "./members-overview-section";
import {
  EMAIL_REGEX,
  MODULE_KEYS,
  splitKeys,
  TAB_ITEMS
} from "./members-settings.model";
import type { ActiveTab, GroupDraft, MemberEditorDraft, WorkspaceRole } from "./members-settings.model";
import { PermissionsMatrixSection } from "./permissions-matrix-section";
import { WorkspaceInvitesSection } from "./workspace-invites-section";
import { WorkspaceModulesSection } from "./workspace-modules-section";
import "./members-settings.css";

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
    return <MembersEmptyState variant="loading" />;
  }

  if (!isCorporateWorkspace) {
    return <MembersEmptyState variant="personal" />;
  }

  const activeModulesCount = moduleCatalog.filter(
    m => accessControl?.moduleEntitlements?.[m] !== false
  ).length;

  return (
    <div className="ms">
      <MembersOverviewSection
        membersCount={members.length}
        pendingInvitesCount={pendingInvites.length}
        activeModulesCount={activeModulesCount}
        groupsCount={groups.length}
      />

      <MembersFeedbackBar feedback={feedback} error={error} />
      <Tabs value={activeTab} items={TAB_ITEMS} onChange={setActiveTab} className="ms-tabs" />

      {activeTab === "members" && (
        <MembersListSection
          isLoadingAccessControl={isLoadingAccessControl}
          members={members}
          accessControl={accessControl}
          onEditMember={setEditingMember}
        />
      )}

      {activeTab === "invites" && (
        <WorkspaceInvitesSection
          inviteEmail={inviteEmail}
          setInviteEmail={setInviteEmail}
          inviteRole={inviteRole}
          setInviteRole={setInviteRole}
          isSubmittingInvite={isSubmittingInvite}
          isLoadingInvites={isLoadingInvites}
          pendingInvites={pendingInvites}
          isResendingInviteId={isResendingInviteId}
          isRevokingInviteId={isRevokingInviteId}
          onInvite={handleInvite}
          onResendInvite={handleResendInvite}
          onRevokeInvite={handleRevokeInvite}
        />
      )}

      {activeTab === "modules" && (
        <WorkspaceModulesSection
          moduleCatalog={moduleCatalog}
          accessControl={accessControl}
          isSavingModuleEntitlements={isSavingModuleEntitlements}
          onToggleModule={handleToggleModule}
        />
      )}

      {activeTab === "groups" && (
        <AccessGroupsSection
          groups={groups}
          isDeletingGroupId={isDeletingGroupId}
          onCreateGroup={() => setEditingGroup("new")}
          onEditGroup={setEditingGroup}
          onDeleteGroup={handleDeleteGroup}
        />
      )}

      {activeTab === "matrix" && (
        <PermissionsMatrixSection accessControl={accessControl} />
      )}

      {editingMember && accessControl && (
        <MemberAccessEditorDrawer
          member={editingMember}
          accessControl={accessControl}
          onSave={handleSaveMemberAccess}
          onClose={() => setEditingMember(null)}
        />
      )}

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
