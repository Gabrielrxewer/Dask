export const routePaths = {
  home: "/",
  login: "/login",
  resetPassword: "/reset-password",
  verifyEmail: "/verify-email",
  choosePlan: "/choose-plan",
  billingSuccess: "/billing/success",
  billingCancel: "/billing/cancel",
  subscriptionBlocked: "/subscription-blocked",
  workspaceEntry: "/w",
  noWorkspace: "/w/no-workspace",
  workspaceBase: "/w/:workspaceSlug",
  board: "/w/:workspaceSlug/board",
  list: "/w/:workspaceSlug/list",
  timeline: "/w/:workspaceSlug/timeline",
  automations: "/w/:workspaceSlug/automations",
  settings: "/w/:workspaceSlug/settings",
  settingsMembers: "/w/:workspaceSlug/settings/members",
  settingsWorkflow: "/w/:workspaceSlug/settings/workflow",
  settingsCustomFields: "/w/:workspaceSlug/settings/custom-fields",
  settingsColumns: "/w/:workspaceSlug/settings/columns",
  settingsItemTypes: "/w/:workspaceSlug/settings/item-types",
  settingsWorkflowStates: "/w/:workspaceSlug/settings/workflow-states",
  settingsPerspectives: "/w/:workspaceSlug/settings/perspectives"
} as const;

export type AppRoutePath = (typeof routePaths)[keyof typeof routePaths];

export function buildWorkspacePath(workspaceSlug: string, path: string): string {
  const normalizedSlug = workspaceSlug.trim().toLowerCase();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `/w/${normalizedSlug}${normalizedPath}`;
}

export function buildWorkspaceBoardPath(workspaceSlug: string): string {
  return buildWorkspacePath(workspaceSlug, "/board");
}

export function buildWorkspaceListPath(workspaceSlug: string): string {
  return buildWorkspacePath(workspaceSlug, "/list");
}

export function buildWorkspaceTimelinePath(workspaceSlug: string): string {
  return buildWorkspacePath(workspaceSlug, "/timeline");
}

export function buildWorkspaceAutomationsPath(workspaceSlug: string): string {
  return buildWorkspacePath(workspaceSlug, "/automations");
}

export function buildWorkspaceSettingsPath(workspaceSlug: string): string {
  return buildWorkspacePath(workspaceSlug, "/settings");
}

export function buildWorkspaceSettingsMembersPath(workspaceSlug: string): string {
  return buildWorkspacePath(workspaceSlug, "/settings/members");
}

export function buildWorkspaceSettingsWorkflowPath(workspaceSlug: string): string {
  return buildWorkspacePath(workspaceSlug, "/settings/workflow");
}

export function buildWorkspaceSettingsCustomFieldsPath(workspaceSlug: string): string {
  return buildWorkspacePath(workspaceSlug, "/settings/custom-fields");
}

export function buildWorkspaceSettingsColumnsPath(workspaceSlug: string): string {
  return buildWorkspacePath(workspaceSlug, "/settings/columns");
}

export function buildWorkspaceSettingsItemTypesPath(workspaceSlug: string): string {
  return buildWorkspacePath(workspaceSlug, "/settings/item-types");
}

export function buildWorkspaceSettingsWorkflowStatesPath(workspaceSlug: string): string {
  return buildWorkspacePath(workspaceSlug, "/settings/workflow-states");
}

export function buildWorkspaceSettingsPerspectivesPath(workspaceSlug: string): string {
  return buildWorkspacePath(workspaceSlug, "/settings/perspectives");
}
