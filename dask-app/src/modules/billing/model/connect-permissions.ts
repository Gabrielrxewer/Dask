import type { WorkspaceRole } from "@/modules/workspace/model";

export const sensitiveConnectSettingsPermissionMessage =
  "Apenas o proprietario do workspace pode alterar a configuracao sensivel do Stripe Connect.";

export function canManageSensitiveConnectSettings(role: WorkspaceRole | null | undefined): boolean {
  return role === "OWNER";
}
