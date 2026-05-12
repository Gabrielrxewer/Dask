import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  useCreateWorkspaceInviteMutation,
  useDeleteWorkspaceAccessGroupMutation,
  useResendWorkspaceInviteMutation,
  useRevokeWorkspaceInviteMutation,
  useSaveWorkspaceAccessGroupMutation,
  useUpdateMemberAccessControlMutation,
  useUpdateWorkspaceModuleEntitlementsMutation,
  useCurrentWorkspace,
  useWorkspaceAccessControlQuery,
  useWorkspacePendingInvitesQuery,
  useWorkspaceSettingsPermissions,
  useWorkspaceSummaryQuery
} from "@/modules/workspace";
import type {
  WorkspaceAccessControlSnapshot,
  WorkspaceAccessGroup,
  WorkspaceAccessControlMember,
  WorkspaceModuleKey
} from "@/modules/workspace/model";
import { Tabs, toast } from "@/shared/ui";
import { AccessGroupEditorDrawer } from "./access-group-editor-drawer";
import { AccessGroupsSection } from "./access-groups-section";
import { MemberAccessEditorDrawer } from "./member-access-editor-drawer";
import { MembersEmptyState } from "./members-empty-state";
import { MembersFeedbackBar } from "./members-feedback-bar";
import { MembersListSection } from "./members-list-section";
import { MembersOverviewSection } from "./members-overview-section";
import {
  MODULE_KEYS,
  splitKeys,
  TAB_ITEMS
} from "./members-settings.model";
import type { ActiveTab, GroupDraft, MemberEditorDraft, WorkspaceInviteFormValues, WorkspaceRole } from "./members-settings.model";
import { PermissionsMatrixSection } from "./permissions-matrix-section";
import { WorkspaceInvitesSection } from "./workspace-invites-section";
import { WorkspaceModulesSection } from "./workspace-modules-section";
import "./members-settings.css";

export function MembersSettings() {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const { snapshot } = useCurrentWorkspace();
  const workspaceSummaryQuery = useWorkspaceSummaryQuery(workspaceSlug);
  const isCorporateWorkspace = workspaceSummaryQuery.data?.kind === "CORPORATE";
  const permissions = useWorkspaceSettingsPermissions(workspaceSlug, snapshot);

  const accessControlQuery = useWorkspaceAccessControlQuery(workspaceSlug, {
    enabled: isCorporateWorkspace
  });
  const invitesQuery = useWorkspacePendingInvitesQuery(workspaceSlug, {
    enabled: isCorporateWorkspace
  });

  const createInviteMutation = useCreateWorkspaceInviteMutation(workspaceSlug);
  const resendInviteMutation = useResendWorkspaceInviteMutation(workspaceSlug);
  const revokeInviteMutation = useRevokeWorkspaceInviteMutation(workspaceSlug);
  const updateModuleEntitlementsMutation = useUpdateWorkspaceModuleEntitlementsMutation(workspaceSlug);
  const updateMemberAccessMutation = useUpdateMemberAccessControlMutation(workspaceSlug);
  const saveAccessGroupMutation = useSaveWorkspaceAccessGroupMutation(workspaceSlug);
  const deleteAccessGroupMutation = useDeleteWorkspaceAccessGroupMutation(workspaceSlug);

  const [activeTab, setActiveTab] = useState<ActiveTab>("members");
  const [editingMember, setEditingMember] = useState<WorkspaceAccessControlMember | null>(null);
  const [editingGroup, setEditingGroup] = useState<WorkspaceAccessGroup | "new" | null>(null);

  const accessControl = accessControlQuery.data ?? null;
  const pendingInvites = invitesQuery.data ?? [];
  const isLoadingAccessControl = accessControlQuery.isLoading || (accessControlQuery.isFetching && !accessControl);
  const isLoadingInvites = invitesQuery.isLoading || (invitesQuery.isFetching && pendingInvites.length === 0);
  const isResendingInviteId = resendInviteMutation.isPending ? resendInviteMutation.variables ?? null : null;
  const isRevokingInviteId = revokeInviteMutation.isPending ? revokeInviteMutation.variables ?? null : null;
  const isDeletingGroupId = deleteAccessGroupMutation.isPending ? deleteAccessGroupMutation.variables ?? null : null;

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
  const activeModulesCount = moduleCatalog.filter(
    m => accessControl?.moduleEntitlements?.[m] !== false
  ).length;

  const loadError = accessControlQuery.isError
    ? "Nao foi possivel carregar roles e permissoes."
    : invitesQuery.isError
      ? "Nao foi possivel carregar os convites pendentes."
      : "";
  const readOnlyMessage = !loadError && permissions.readOnlyReason ? permissions.readOnlyReason : "";

  const ensureCanManageMembers = () => {
    if (permissions.canManageMembers) {
      return true;
    }

    toast.error("Voce nao tem permissao para alterar pessoas e acessos.");
    return false;
  };

  const handleInvite = async (values: WorkspaceInviteFormValues): Promise<boolean> => {
    if (!ensureCanManageMembers()) {
      return false;
    }

    const email = values.email;
    if (pendingInvites.some(i => i.email === email && i.status === "PENDING")) {
      toast.error("Este e-mail ja possui um convite pendente.");
      return false;
    }

    await createInviteMutation.mutateAsync({ email, role: values.role });
    return true;
  };

  const handleResendInvite = async (inviteId: string) => {
    if (!ensureCanManageMembers()) {
      return;
    }

    await resendInviteMutation.mutateAsync(inviteId);
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!ensureCanManageMembers()) {
      return;
    }

    await revokeInviteMutation.mutateAsync(inviteId);
  };

  const handleToggleModule = async (moduleKey: WorkspaceModuleKey, enabled: boolean) => {
    if (!permissions.canManageModuleEntitlements) {
      toast.error("Voce nao tem permissao para alterar modulos.");
      return;
    }

    const current = accessControl?.moduleEntitlements ?? {};
    await updateModuleEntitlementsMutation.mutateAsync({
      ...current,
      [moduleKey]: enabled,
    });
  };

  const handleSaveMemberAccess = async (userId: string, draft: MemberEditorDraft) => {
    if (!ensureCanManageMembers()) {
      return;
    }

    await updateMemberAccessMutation.mutateAsync({
      memberUserId: userId,
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
    setEditingMember(null);
  };

  const handleSaveGroup = async (draft: GroupDraft) => {
    if (!permissions.canManageAccessGroups) {
      toast.error("Voce nao tem permissao para alterar grupos.");
      return;
    }

    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      allow: draft.allow,
      deny: draft.deny,
      allowedModules: draft.allowedModules,
      allowedBoardViewKeys: splitKeys(draft.boardViewKeys),
      ownCardsOnly: draft.ownCardsOnly,
    };
    await saveAccessGroupMutation.mutateAsync({
      groupId: editingGroup && editingGroup !== "new" ? editingGroup.id : undefined,
      input: payload,
    });
    setEditingGroup(null);
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!permissions.canManageAccessGroups) {
      toast.error("Voce nao tem permissao para remover grupos.");
      return;
    }

    await deleteAccessGroupMutation.mutateAsync(groupId);
  };

  if (workspaceSummaryQuery.isLoading || permissions.isLoading) {
    return <MembersEmptyState variant="loading" />;
  }

  if (!isCorporateWorkspace) {
    return <MembersEmptyState variant="personal" />;
  }

  return (
    <div className="ms">
      <MembersOverviewSection
        membersCount={members.length}
        pendingInvitesCount={pendingInvites.length}
        activeModulesCount={activeModulesCount}
        groupsCount={groups.length}
      />

      <MembersFeedbackBar feedback="" error={loadError || readOnlyMessage} />
      <Tabs value={activeTab} items={TAB_ITEMS} onChange={setActiveTab} className="ms-tabs" />

      {activeTab === "members" && (
        <MembersListSection
          isLoadingAccessControl={isLoadingAccessControl}
          members={members}
          accessControl={accessControl}
          canEditMembers={permissions.canManageMembers}
          onEditMember={setEditingMember}
        />
      )}

      {activeTab === "invites" && (
        <WorkspaceInvitesSection
          canInviteMembers={permissions.canManageMembers}
          isSubmittingInvite={createInviteMutation.isPending}
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
          canManageModules={permissions.canManageModuleEntitlements}
          isSavingModuleEntitlements={updateModuleEntitlementsMutation.isPending}
          onToggleModule={handleToggleModule}
        />
      )}

      {activeTab === "groups" && (
        <AccessGroupsSection
          groups={groups}
          canManageGroups={permissions.canManageAccessGroups}
          isDeletingGroupId={isDeletingGroupId}
          onCreateGroup={() => setEditingGroup("new")}
          onEditGroup={setEditingGroup}
          onDeleteGroup={handleDeleteGroup}
        />
      )}

      {activeTab === "matrix" && (
        <PermissionsMatrixSection accessControl={accessControl} />
      )}

      {editingMember && accessControl && permissions.canManageMembers && (
        <MemberAccessEditorDrawer
          member={editingMember}
          accessControl={accessControl}
          onSave={handleSaveMemberAccess}
          onClose={() => setEditingMember(null)}
        />
      )}

      {editingGroup && permissions.canManageAccessGroups && (
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
