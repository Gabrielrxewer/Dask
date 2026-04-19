-- CreateEnum
CREATE TYPE "MarketingCampaignStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MarketingCampaignChannel" AS ENUM ('EMAIL', 'NEWSLETTER');

-- CreateEnum
CREATE TYPE "MarketingCampaignObjective" AS ENUM ('LEAD_NURTURE', 'ONBOARDING', 'REACTIVATION', 'BILLING_REMINDER', 'RENEWAL', 'EXPANSION', 'PRODUCT_UPDATE', 'NEWSLETTER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MarketingAudienceType" AS ENUM ('STATIC', 'DYNAMIC');

-- CreateEnum
CREATE TYPE "MarketingEventType" AS ENUM ('CAMPAIGN_CREATED', 'CAMPAIGN_UPDATED', 'CAMPAIGN_REVIEW_REQUESTED', 'CAMPAIGN_APPROVED', 'CAMPAIGN_SCHEDULED', 'CAMPAIGN_LAUNCHED', 'SEND_QUEUED', 'EMAIL_SENT', 'EMAIL_DELIVERED', 'EMAIL_OPENED', 'EMAIL_CLICKED', 'EMAIL_BOUNCED', 'EMAIL_COMPLAINT', 'EMAIL_UNSUBSCRIBED', 'LEAD_SCORE_CHANGED', 'AUTOMATION_ENROLLED', 'AUTOMATION_EXITED', 'OPPORTUNITY_INFLUENCED', 'CUSTOMER_CONVERTED', 'BILLING_SIGNAL_TRIGGERED', 'AI_GENERATED', 'AI_IMPROVED', 'TASK_CREATED', 'DOCUMENT_LINKED');

-- CreateEnum
CREATE TYPE "MarketingConsentStatus" AS ENUM ('OPT_IN', 'OPT_OUT', 'UNSUBSCRIBED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MarketingMessageKind" AS ENUM ('MARKETING', 'TRANSACTIONAL');

-- CreateEnum
CREATE TYPE "MarketingSendStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'COMPLAINED', 'UNSUBSCRIBED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "MarketingAutomationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MarketingAutomationStepKind" AS ENUM ('TRIGGER', 'CONDITION', 'DELAY', 'ACTION', 'BRANCH', 'EXIT');

-- CreateEnum
CREATE TYPE "MarketingAutomationEnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXITED', 'FAILED');

-- CreateEnum
CREATE TYPE "MarketingAttributionType" AS ENUM ('FIRST_TOUCH', 'LAST_TOUCH', 'MULTI_TOUCH');

-- CreateEnum
CREATE TYPE "MarketingAttributionEntityType" AS ENUM ('LEAD', 'OPPORTUNITY', 'CUSTOMER', 'SUBSCRIPTION', 'INVOICE');

-- CreateTable
CREATE TABLE "MarketingAudienceSegment" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "kind" "MarketingAudienceType" NOT NULL DEFAULT 'DYNAMIC',
  "filters" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "lastEvaluatedAt" TIMESTAMP(3),
  "estimatedContacts" INTEGER,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingAudienceSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingEmailTemplate" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "category" TEXT,
  "objective" "MarketingCampaignObjective",
  "funnelStage" TEXT,
  "subject" TEXT NOT NULL,
  "bodyMarkdown" TEXT NOT NULL,
  "bodyHtml" TEXT,
  "blocks" JSONB,
  "performanceSnapshot" JSONB,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingEmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingSenderProfile" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "fromName" TEXT NOT NULL,
  "fromEmail" TEXT NOT NULL,
  "replyToEmail" TEXT,
  "providerKey" TEXT NOT NULL DEFAULT 'default',
  "domainStatus" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "config" JSONB,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingSenderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingCampaign" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "objective" "MarketingCampaignObjective" NOT NULL,
  "channel" "MarketingCampaignChannel" NOT NULL DEFAULT 'EMAIL',
  "status" "MarketingCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "hypothesis" TEXT,
  "persona" TEXT,
  "icp" TEXT,
  "offer" TEXT,
  "productRef" TEXT,
  "billingContext" TEXT,
  "segmentId" TEXT,
  "templateId" TEXT,
  "senderProfileId" TEXT,
  "abTestEnabled" BOOLEAN NOT NULL DEFAULT false,
  "abTestConfig" JSONB,
  "scheduledAt" TIMESTAMP(3),
  "launchedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "approvalRequestedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "approvedByUserId" TEXT,
  "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
  "aiContext" JSONB,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingCampaignVariant" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "templateId" TEXT,
  "name" TEXT NOT NULL,
  "isControl" BOOLEAN NOT NULL DEFAULT false,
  "weight" INTEGER NOT NULL DEFAULT 100,
  "subject" TEXT NOT NULL,
  "preheader" TEXT,
  "bodyMarkdown" TEXT NOT NULL,
  "bodyHtml" TEXT,
  "variables" JSONB,
  "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
  "aiMetadata" JSONB,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingCampaignVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingContactPreference" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "leadId" TEXT,
  "email" TEXT NOT NULL,
  "messageKind" "MarketingMessageKind" NOT NULL DEFAULT 'MARKETING',
  "consentStatus" "MarketingConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
  "consentSource" TEXT,
  "legalBasis" TEXT,
  "allowEmail" BOOLEAN NOT NULL DEFAULT true,
  "allowNewsletter" BOOLEAN NOT NULL DEFAULT true,
  "allowBilling" BOOLEAN NOT NULL DEFAULT true,
  "unsubscribeAt" TIMESTAMP(3),
  "preferences" JSONB,
  "lastEngagementAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingContactPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingConsentRecord" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "leadId" TEXT,
  "email" TEXT NOT NULL,
  "messageKind" "MarketingMessageKind" NOT NULL DEFAULT 'MARKETING',
  "status" "MarketingConsentStatus" NOT NULL,
  "source" TEXT NOT NULL,
  "reason" TEXT,
  "legalBasis" TEXT,
  "evidence" JSONB,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorUserId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingCampaignSend" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "leadId" TEXT,
  "senderProfileId" TEXT,
  "contactEmail" TEXT NOT NULL,
  "status" "MarketingSendStatus" NOT NULL DEFAULT 'QUEUED',
  "idempotencyKey" TEXT NOT NULL,
  "providerKey" TEXT,
  "providerMessageId" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "openedAt" TIMESTAMP(3),
  "clickedAt" TIMESTAMP(3),
  "bouncedAt" TIMESTAMP(3),
  "complainedAt" TIMESTAMP(3),
  "unsubscribedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingCampaignSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAutomationFlow" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "MarketingAutomationStatus" NOT NULL DEFAULT 'DRAFT',
  "triggerDefinition" JSONB NOT NULL,
  "entryCriteria" JSONB,
  "exitCriteria" JSONB,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingAutomationFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAutomationStep" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "flowId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "MarketingAutomationStepKind" NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "config" JSONB,
  "nextStepId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingAutomationStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAutomationEnrollment" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "flowId" TEXT NOT NULL,
  "leadId" TEXT,
  "campaignId" TEXT,
  "status" "MarketingAutomationEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "entryEventId" TEXT,
  "exitReason" TEXT,
  "context" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextRunAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingAutomationEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "type" "MarketingEventType" NOT NULL,
  "campaignId" TEXT,
  "variantId" TEXT,
  "segmentId" TEXT,
  "leadId" TEXT,
  "sendId" TEXT,
  "automationFlowId" TEXT,
  "documentId" TEXT,
  "itemId" TEXT,
  "billingRef" TEXT,
  "externalEventId" TEXT,
  "headline" TEXT,
  "description" TEXT,
  "payload" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingLeadScoreEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "campaignId" TEXT,
  "eventId" TEXT,
  "delta" INTEGER NOT NULL,
  "previousScore" INTEGER,
  "nextScore" INTEGER,
  "reason" TEXT NOT NULL,
  "isAutomated" BOOLEAN NOT NULL DEFAULT true,
  "explanation" JSONB,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingLeadScoreEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAttribution" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "leadId" TEXT,
  "attributionType" "MarketingAttributionType" NOT NULL,
  "entityType" "MarketingAttributionEntityType" NOT NULL,
  "entityRef" TEXT NOT NULL,
  "influenceScore" DECIMAL(6,4),
  "revenueInfluenced" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "happenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingContentAsset" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "campaignId" TEXT,
  "templateId" TEXT,
  "documentId" TEXT,
  "title" TEXT NOT NULL,
  "assetType" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingContentAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAudienceSegment_workspaceId_name_key" ON "MarketingAudienceSegment"("workspaceId", "name");
CREATE INDEX "MarketingAudienceSegment_workspaceId_isActive_updatedAt_idx" ON "MarketingAudienceSegment"("workspaceId", "isActive", "updatedAt");

CREATE UNIQUE INDEX "MarketingEmailTemplate_workspaceId_slug_key" ON "MarketingEmailTemplate"("workspaceId", "slug");
CREATE INDEX "MarketingEmailTemplate_workspaceId_isArchived_updatedAt_idx" ON "MarketingEmailTemplate"("workspaceId", "isArchived", "updatedAt");

CREATE UNIQUE INDEX "MarketingSenderProfile_workspaceId_fromEmail_key" ON "MarketingSenderProfile"("workspaceId", "fromEmail");
CREATE INDEX "MarketingSenderProfile_workspaceId_isDefault_idx" ON "MarketingSenderProfile"("workspaceId", "isDefault");

CREATE INDEX "MarketingCampaign_workspaceId_status_scheduledAt_idx" ON "MarketingCampaign"("workspaceId", "status", "scheduledAt");
CREATE INDEX "MarketingCampaign_workspaceId_objective_createdAt_idx" ON "MarketingCampaign"("workspaceId", "objective", "createdAt");
CREATE INDEX "MarketingCampaign_workspaceId_segmentId_updatedAt_idx" ON "MarketingCampaign"("workspaceId", "segmentId", "updatedAt");

CREATE INDEX "MarketingCampaignVariant_campaignId_weight_idx" ON "MarketingCampaignVariant"("campaignId", "weight");
CREATE INDEX "MarketingCampaignVariant_workspaceId_campaignId_createdAt_idx" ON "MarketingCampaignVariant"("workspaceId", "campaignId", "createdAt");

CREATE UNIQUE INDEX "MarketingContactPreference_workspaceId_email_messageKind_key" ON "MarketingContactPreference"("workspaceId", "email", "messageKind");
CREATE UNIQUE INDEX "MarketingContactPreference_workspaceId_leadId_messageKind_key" ON "MarketingContactPreference"("workspaceId", "leadId", "messageKind");
CREATE INDEX "MarketingContactPreference_workspaceId_consentStatus_updatedAt_idx" ON "MarketingContactPreference"("workspaceId", "consentStatus", "updatedAt");
CREATE INDEX "MarketingContactPreference_workspaceId_leadId_idx" ON "MarketingContactPreference"("workspaceId", "leadId");

CREATE INDEX "MarketingConsentRecord_workspaceId_email_recordedAt_idx" ON "MarketingConsentRecord"("workspaceId", "email", "recordedAt");
CREATE INDEX "MarketingConsentRecord_workspaceId_leadId_recordedAt_idx" ON "MarketingConsentRecord"("workspaceId", "leadId", "recordedAt");

CREATE UNIQUE INDEX "MarketingCampaignSend_idempotencyKey_key" ON "MarketingCampaignSend"("idempotencyKey");
CREATE INDEX "MarketingCampaignSend_workspaceId_campaignId_status_createdAt_idx" ON "MarketingCampaignSend"("workspaceId", "campaignId", "status", "createdAt");
CREATE INDEX "MarketingCampaignSend_workspaceId_leadId_createdAt_idx" ON "MarketingCampaignSend"("workspaceId", "leadId", "createdAt");
CREATE INDEX "MarketingCampaignSend_workspaceId_providerMessageId_idx" ON "MarketingCampaignSend"("workspaceId", "providerMessageId");

CREATE UNIQUE INDEX "MarketingAutomationFlow_workspaceId_name_key" ON "MarketingAutomationFlow"("workspaceId", "name");
CREATE INDEX "MarketingAutomationFlow_workspaceId_status_updatedAt_idx" ON "MarketingAutomationFlow"("workspaceId", "status", "updatedAt");

CREATE UNIQUE INDEX "MarketingAutomationStep_flowId_key_key" ON "MarketingAutomationStep"("flowId", "key");
CREATE INDEX "MarketingAutomationStep_workspaceId_flowId_position_idx" ON "MarketingAutomationStep"("workspaceId", "flowId", "position");

CREATE INDEX "MarketingAutomationEnrollment_workspaceId_flowId_status_startedAt_idx" ON "MarketingAutomationEnrollment"("workspaceId", "flowId", "status", "startedAt");
CREATE INDEX "MarketingAutomationEnrollment_workspaceId_leadId_startedAt_idx" ON "MarketingAutomationEnrollment"("workspaceId", "leadId", "startedAt");

CREATE UNIQUE INDEX "MarketingEvent_workspaceId_externalEventId_key" ON "MarketingEvent"("workspaceId", "externalEventId");
CREATE INDEX "MarketingEvent_workspaceId_occurredAt_idx" ON "MarketingEvent"("workspaceId", "occurredAt");
CREATE INDEX "MarketingEvent_workspaceId_leadId_occurredAt_idx" ON "MarketingEvent"("workspaceId", "leadId", "occurredAt");
CREATE INDEX "MarketingEvent_workspaceId_campaignId_occurredAt_idx" ON "MarketingEvent"("workspaceId", "campaignId", "occurredAt");
CREATE INDEX "MarketingEvent_workspaceId_type_occurredAt_idx" ON "MarketingEvent"("workspaceId", "type", "occurredAt");

CREATE INDEX "MarketingLeadScoreEvent_workspaceId_leadId_createdAt_idx" ON "MarketingLeadScoreEvent"("workspaceId", "leadId", "createdAt");
CREATE INDEX "MarketingLeadScoreEvent_workspaceId_campaignId_createdAt_idx" ON "MarketingLeadScoreEvent"("workspaceId", "campaignId", "createdAt");

CREATE INDEX "MarketingAttribution_workspaceId_entityType_entityRef_idx" ON "MarketingAttribution"("workspaceId", "entityType", "entityRef");
CREATE INDEX "MarketingAttribution_workspaceId_campaignId_happenedAt_idx" ON "MarketingAttribution"("workspaceId", "campaignId", "happenedAt");
CREATE INDEX "MarketingAttribution_workspaceId_leadId_happenedAt_idx" ON "MarketingAttribution"("workspaceId", "leadId", "happenedAt");

CREATE INDEX "MarketingContentAsset_workspaceId_campaignId_createdAt_idx" ON "MarketingContentAsset"("workspaceId", "campaignId", "createdAt");
CREATE INDEX "MarketingContentAsset_workspaceId_templateId_createdAt_idx" ON "MarketingContentAsset"("workspaceId", "templateId", "createdAt");
CREATE INDEX "MarketingContentAsset_workspaceId_documentId_createdAt_idx" ON "MarketingContentAsset"("workspaceId", "documentId", "createdAt");

-- AddForeignKey
ALTER TABLE "MarketingAudienceSegment" ADD CONSTRAINT "MarketingAudienceSegment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingEmailTemplate" ADD CONSTRAINT "MarketingEmailTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingSenderProfile" ADD CONSTRAINT "MarketingSenderProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "MarketingAudienceSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MarketingEmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_senderProfileId_fkey" FOREIGN KEY ("senderProfileId") REFERENCES "MarketingSenderProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingCampaignVariant" ADD CONSTRAINT "MarketingCampaignVariant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingCampaignVariant" ADD CONSTRAINT "MarketingCampaignVariant_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingCampaignVariant" ADD CONSTRAINT "MarketingCampaignVariant_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MarketingEmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingContactPreference" ADD CONSTRAINT "MarketingContactPreference_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingContactPreference" ADD CONSTRAINT "MarketingContactPreference_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingConsentRecord" ADD CONSTRAINT "MarketingConsentRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingConsentRecord" ADD CONSTRAINT "MarketingConsentRecord_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingCampaignSend" ADD CONSTRAINT "MarketingCampaignSend_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingCampaignSend" ADD CONSTRAINT "MarketingCampaignSend_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingCampaignSend" ADD CONSTRAINT "MarketingCampaignSend_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "MarketingCampaignVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingCampaignSend" ADD CONSTRAINT "MarketingCampaignSend_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingCampaignSend" ADD CONSTRAINT "MarketingCampaignSend_senderProfileId_fkey" FOREIGN KEY ("senderProfileId") REFERENCES "MarketingSenderProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingAutomationFlow" ADD CONSTRAINT "MarketingAutomationFlow_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingAutomationStep" ADD CONSTRAINT "MarketingAutomationStep_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingAutomationStep" ADD CONSTRAINT "MarketingAutomationStep_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "MarketingAutomationFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingAutomationEnrollment" ADD CONSTRAINT "MarketingAutomationEnrollment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingAutomationEnrollment" ADD CONSTRAINT "MarketingAutomationEnrollment_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "MarketingAutomationFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingAutomationEnrollment" ADD CONSTRAINT "MarketingAutomationEnrollment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingAutomationEnrollment" ADD CONSTRAINT "MarketingAutomationEnrollment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingEvent" ADD CONSTRAINT "MarketingEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingEvent" ADD CONSTRAINT "MarketingEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingEvent" ADD CONSTRAINT "MarketingEvent_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "MarketingCampaignVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingEvent" ADD CONSTRAINT "MarketingEvent_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "MarketingAudienceSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingEvent" ADD CONSTRAINT "MarketingEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingEvent" ADD CONSTRAINT "MarketingEvent_sendId_fkey" FOREIGN KEY ("sendId") REFERENCES "MarketingCampaignSend"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingEvent" ADD CONSTRAINT "MarketingEvent_automationFlowId_fkey" FOREIGN KEY ("automationFlowId") REFERENCES "MarketingAutomationFlow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingLeadScoreEvent" ADD CONSTRAINT "MarketingLeadScoreEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingLeadScoreEvent" ADD CONSTRAINT "MarketingLeadScoreEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingLeadScoreEvent" ADD CONSTRAINT "MarketingLeadScoreEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingLeadScoreEvent" ADD CONSTRAINT "MarketingLeadScoreEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MarketingEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingAttribution" ADD CONSTRAINT "MarketingAttribution_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingAttribution" ADD CONSTRAINT "MarketingAttribution_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingAttribution" ADD CONSTRAINT "MarketingAttribution_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingContentAsset" ADD CONSTRAINT "MarketingContentAsset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingContentAsset" ADD CONSTRAINT "MarketingContentAsset_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingContentAsset" ADD CONSTRAINT "MarketingContentAsset_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MarketingEmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingContentAsset" ADD CONSTRAINT "MarketingContentAsset_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "WorkspaceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
