ALTER TABLE "AutomationSideEffect" ADD COLUMN "templateVersionId" TEXT;

CREATE TABLE "CommunicationTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'follow_up',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "CommunicationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationTemplateVersion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "subject" TEXT,
    "textBody" TEXT,
    "htmlBody" TEXT,
    "variablesJson" JSONB,
    "metadataJson" JSONB,
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationTemplateVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContactConsent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactType" TEXT,
    "contactId" TEXT,
    "channel" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "source" TEXT,
    "reason" TEXT,
    "optInAt" TIMESTAMP(3),
    "optOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactConsent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationSuppression" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "metadataJson" JSONB,

    CONSTRAINT "CommunicationSuppression_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationUnsubscribeToken" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "category" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationUnsubscribeToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunicationTemplate_workspaceId_key_key" ON "CommunicationTemplate"("workspaceId", "key");
CREATE INDEX "CommunicationTemplate_workspaceId_channel_status_updatedAt_idx" ON "CommunicationTemplate"("workspaceId", "channel", "status", "updatedAt");
CREATE INDEX "CommunicationTemplate_workspaceId_category_status_idx" ON "CommunicationTemplate"("workspaceId", "category", "status");

CREATE UNIQUE INDEX "CommunicationTemplateVersion_templateId_version_key" ON "CommunicationTemplateVersion"("templateId", "version");
CREATE INDEX "CommunicationTemplateVersion_workspaceId_status_createdAt_idx" ON "CommunicationTemplateVersion"("workspaceId", "status", "createdAt");
CREATE INDEX "CommunicationTemplateVersion_workspaceId_templateId_status_version_idx" ON "CommunicationTemplateVersion"("workspaceId", "templateId", "status", "version");

CREATE UNIQUE INDEX "ContactConsent_workspaceId_channel_address_key" ON "ContactConsent"("workspaceId", "channel", "address");
CREATE INDEX "ContactConsent_workspaceId_channel_status_updatedAt_idx" ON "ContactConsent"("workspaceId", "channel", "status", "updatedAt");
CREATE INDEX "ContactConsent_workspaceId_contactType_contactId_idx" ON "ContactConsent"("workspaceId", "contactType", "contactId");

CREATE UNIQUE INDEX "CommunicationSuppression_workspaceId_channel_address_key" ON "CommunicationSuppression"("workspaceId", "channel", "address");
CREATE INDEX "CommunicationSuppression_workspaceId_channel_createdAt_idx" ON "CommunicationSuppression"("workspaceId", "channel", "createdAt");
CREATE INDEX "CommunicationSuppression_workspaceId_channel_reason_idx" ON "CommunicationSuppression"("workspaceId", "channel", "reason");

CREATE UNIQUE INDEX "CommunicationUnsubscribeToken_tokenHash_key" ON "CommunicationUnsubscribeToken"("tokenHash");
CREATE INDEX "CommunicationUnsubscribeToken_workspaceId_channel_address_idx" ON "CommunicationUnsubscribeToken"("workspaceId", "channel", "address");
CREATE INDEX "CommunicationUnsubscribeToken_expiresAt_usedAt_idx" ON "CommunicationUnsubscribeToken"("expiresAt", "usedAt");
CREATE INDEX "AutomationSideEffect_templateVersionId_idx" ON "AutomationSideEffect"("templateVersionId");

ALTER TABLE "AutomationSideEffect" ADD CONSTRAINT "AutomationSideEffect_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "CommunicationTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationTemplate" ADD CONSTRAINT "CommunicationTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationTemplate" ADD CONSTRAINT "CommunicationTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationTemplateVersion" ADD CONSTRAINT "CommunicationTemplateVersion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationTemplateVersion" ADD CONSTRAINT "CommunicationTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CommunicationTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationTemplateVersion" ADD CONSTRAINT "CommunicationTemplateVersion_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContactConsent" ADD CONSTRAINT "ContactConsent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationSuppression" ADD CONSTRAINT "CommunicationSuppression_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationUnsubscribeToken" ADD CONSTRAINT "CommunicationUnsubscribeToken_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
