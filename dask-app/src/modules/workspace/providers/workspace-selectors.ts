import { useMemo } from "react";
import { useParams } from "react-router-dom";
import type { WorkspaceModuleKey, WorkspacePreferences, WorkspaceSnapshot, WorkspaceSummary } from "@/modules/workspace/model";
import { useWorkspaceSettingsActions, useWorkspaceSnapshotQuery, useWorkspaceSummaryQuery } from "@/modules/workspace/query";

const DEFAULT_MODULES: WorkspaceModuleKey[] = [
  "dashboard",
  "board",
  "automation",
  "documentation",
  "billing",
  "ai",
  "settings",
  "fiscal",
  "commercial",
  "marketing"
];

export interface CurrentWorkspaceModel {
  workspaceSlug: string;
  workspaceId: string | null;
  summary: WorkspaceSummary | null;
  snapshot: WorkspaceSnapshot | null;
  isLoading: boolean;
  isSnapshotLoading: boolean;
  isSummaryLoading: boolean;
}

export function useCurrentWorkspace(): CurrentWorkspaceModel {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const snapshotQuery = useWorkspaceSnapshotQuery(workspaceSlug);
  const summaryQuery = useWorkspaceSummaryQuery(workspaceSlug);
  const snapshot = snapshotQuery.data ?? null;
  const summary = summaryQuery.data ?? null;

  return useMemo(
    () => ({
      workspaceSlug,
      workspaceId: snapshot?.id ?? summary?.id ?? null,
      summary,
      snapshot,
      isLoading: Boolean(workspaceSlug) && (snapshotQuery.isLoading || summaryQuery.isLoading),
      isSnapshotLoading: Boolean(workspaceSlug) && snapshotQuery.isLoading,
      isSummaryLoading: Boolean(workspaceSlug) && summaryQuery.isLoading
    }),
    [
      snapshot,
      snapshotQuery.isLoading,
      summary,
      summaryQuery.isLoading,
      workspaceSlug
    ]
  );
}

export function useWorkspacePermissions() {
  const current = useCurrentWorkspace();
  const access = current.snapshot?.access ?? null;
  const role = access?.role ?? current.summary?.role ?? null;
  const allowedModules = access?.allowedModules ?? DEFAULT_MODULES;
  const allowedModuleSet = useMemo(() => new Set<WorkspaceModuleKey>(allowedModules), [allowedModules]);
  const isClient = Boolean(access?.isClient || role === "CLIENT");

  return useMemo(
    () => ({
      role,
      isClient,
      ownCardsOnly: access?.ownCardsOnly ?? false,
      customerIds: access?.customerIds ?? [],
      allowedModules,
      moduleEntitlements: access?.moduleEntitlements ?? {},
      allowedBoardViewKeys: access?.allowedBoardViewKeys ?? null,
      canAccessModule: (module: WorkspaceModuleKey) => allowedModuleSet.has(module),
      isLoading: current.isLoading
    }),
    [
      access?.allowedBoardViewKeys,
      access?.customerIds,
      access?.moduleEntitlements,
      access?.ownCardsOnly,
      allowedModuleSet,
      allowedModules,
      current.isLoading,
      isClient,
      role
    ]
  );
}

export function useWorkspaceMembers() {
  const { snapshot, isSnapshotLoading } = useCurrentWorkspace();
  const membersById = snapshot?.membersById ?? {};

  return useMemo(
    () => ({
      membersById,
      members: Object.values(membersById),
      currentMember: snapshot?.currentUserId ? membersById[snapshot.currentUserId] ?? null : null,
      isLoading: isSnapshotLoading
    }),
    [isSnapshotLoading, membersById, snapshot?.currentUserId]
  );
}

export function useWorkspaceSettings() {
  const current = useCurrentWorkspace();
  const actions = useWorkspaceSettingsActions(current.workspaceSlug);
  const preferences = current.snapshot?.preferences ?? null;
  const settings = (preferences?.settings as Record<string, unknown> | undefined) ?? {};

  return useMemo(
    () => ({
      workspaceSlug: current.workspaceSlug,
      snapshot: current.snapshot,
      preferences: preferences as WorkspacePreferences | null,
      settings,
      updatePreferences: actions.updatePreferences,
      resetWorkspaceTemplate: actions.resetWorkspaceTemplate,
      isLoading: current.isSnapshotLoading
    }),
    [
      actions.resetWorkspaceTemplate,
      actions.updatePreferences,
      current.isSnapshotLoading,
      current.snapshot,
      current.workspaceSlug,
      preferences,
      settings
    ]
  );
}
