CREATE TABLE "WorkspaceWhatsAppIntegration" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'meta',
  "status" TEXT NOT NULL DEFAULT 'configured',
  "phoneNumberId" TEXT NOT NULL,
  "wabaId" TEXT,
  "displayPhoneNumber" TEXT,
  "verifiedName" TEXT,
  "graphApiVersion" TEXT NOT NULL DEFAULT 'v23.0',
  "accessTokenCiphertext" TEXT NOT NULL,
  "accessTokenIv" TEXT NOT NULL,
  "accessTokenAuthTag" TEXT NOT NULL,
  "accessTokenLast4" TEXT,
  "tokenUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastTestedAt" TIMESTAMP(3),
  "lastTestStatus" TEXT,
  "lastTestError" TEXT,
  "metadataJson" JSONB,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkspaceWhatsAppIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceWhatsAppIntegration_workspaceId_provider_key"
  ON "WorkspaceWhatsAppIntegration"("workspaceId", "provider");

CREATE INDEX "WorkspaceWhatsAppIntegration_workspaceId_status_updatedAt_idx"
  ON "WorkspaceWhatsAppIntegration"("workspaceId", "status", "updatedAt");

CREATE INDEX "WorkspaceWhatsAppIntegration_workspaceId_phoneNumberId_idx"
  ON "WorkspaceWhatsAppIntegration"("workspaceId", "phoneNumberId");

ALTER TABLE "WorkspaceWhatsAppIntegration"
  ADD CONSTRAINT "WorkspaceWhatsAppIntegration_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceWhatsAppIntegration"
  ADD CONSTRAINT "WorkspaceWhatsAppIntegration_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkspaceWhatsAppIntegration"
  ADD CONSTRAINT "WorkspaceWhatsAppIntegration_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
