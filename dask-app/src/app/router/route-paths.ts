export const routePaths = {
  home: "/",
  login: "/login",
  resetPassword: "/reset-password",
  verifyEmail: "/verify-email",
  termsOfUse: "/termos-de-uso",
  privacyPolicy: "/politica-de-privacidade",
  choosePlan: "/choose-plan",
  proposalPublic: "/proposals/public/:token",
  billingSuccess: "/billing/success",
  billingCancel: "/billing/cancel",
  subscriptionBlocked: "/subscription-blocked",
  admin: "/admin",
  workspaceEntry: "/w",
  workspaceSelector: "/w/select",
  noWorkspace: "/w/no-workspace",
  workspaceBase: "/w/:workspaceSlug",
  board: "/w/:workspaceSlug/board",
  list: "/w/:workspaceSlug/list",
  agenda: "/w/:workspaceSlug/agenda",
  documentation: "/w/:workspaceSlug/documentation",
  aiAgents: "/w/:workspaceSlug/ai",
  automations: "/w/:workspaceSlug/automations",
  fiscal: "/w/:workspaceSlug/fiscal",
  leads: "/w/:workspaceSlug/leads",
  marketing: "/w/:workspaceSlug/marketing",
  billing: "/w/:workspaceSlug/billing",
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

export function buildWorkspaceSelectorPath(): string {
  return routePaths.workspaceSelector;
}

export function buildProposalPublicPath(token: string): string {
  return `/proposals/public/${encodeURIComponent(token)}`;
}

export function buildWorkspaceListPath(workspaceSlug: string): string {
  return buildWorkspacePath(workspaceSlug, "/list");
}

export function buildWorkspaceAgendaPath(workspaceSlug: string): string {
  return buildWorkspacePath(workspaceSlug, "/agenda");
}

export function buildWorkspaceDocumentationPath(workspaceSlug: string): string {
  return buildWorkspacePath(workspaceSlug, "/documentation");
}

export function buildWorkspaceDocumentationPathWithDoc(
  workspaceSlug: string,
  docId: string,
  taskId: string,
  boardMode: string
): string {
  const params = new URLSearchParams({ docId, from: "card", taskId, boardMode });
  return `${buildWorkspacePath(workspaceSlug, "/documentation")}?${params.toString()}`;
}

export function buildWorkspaceBoardPathWithTask(workspaceSlug: string, taskId: string, boardMode: string): string {
  const params = new URLSearchParams({ openTaskId: taskId, boardMode });
  return `${buildWorkspacePath(workspaceSlug, "/board")}?${params.toString()}`;
}

export function buildWorkspaceAiAgentsPath(workspaceSlug: string): string {
  return buildWorkspacePath(workspaceSlug, "/ai");
}

export function buildWorkspaceAutomationsPath(workspaceSlug: string): string {
  return buildWorkspacePath(workspaceSlug, "/automations");
}

export function buildWorkspaceFiscalPath(workspaceSlug: string): string {
  return buildWorkspacePath(workspaceSlug, "/fiscal");
}

export function buildWorkspaceLeadsPath(workspaceSlug: string): string {
  return buildWorkspacePath(workspaceSlug, "/leads");
}

export function buildWorkspaceMarketingPath(workspaceSlug: string): string {
  return buildWorkspacePath(workspaceSlug, "/marketing");
}

export function buildWorkspaceBillingPath(workspaceSlug: string): string {
  return buildWorkspacePath(workspaceSlug, "/billing");
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
