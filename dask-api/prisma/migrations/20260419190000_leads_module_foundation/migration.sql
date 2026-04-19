-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('CAPTURED', 'QUALIFIED', 'DISTRIBUTED', 'FOLLOW_UP', 'NURTURING', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('MANUAL', 'API', 'WEBHOOK', 'IMPORT', 'INTEGRATION');

-- CreateEnum
CREATE TYPE "LeadQualificationStatus" AS ENUM ('UNQUALIFIED', 'MQL', 'SQL', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "LeadDistributionStatus" AS ENUM ('UNASSIGNED', 'ASSIGNED', 'ACCEPTED', 'REASSIGNED');

-- CreateEnum
CREATE TYPE "LeadDistributionStrategy" AS ENUM ('MANUAL', 'ROUND_ROBIN', 'RULE_BASED', 'TERRITORY');

-- CreateEnum
CREATE TYPE "LeadActivityType" AS ENUM ('CAPTURED', 'QUALIFIED', 'DISTRIBUTED', 'FOLLOW_UP', 'NURTURE_TOUCH', 'CONVERTED', 'STATUS_CHANGED', 'NOTE');

-- CreateEnum
CREATE TYPE "LeadNurtureStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENT', 'RESPONDED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "LeadConversionType" AS ENUM ('CUSTOMER', 'OPPORTUNITY', 'DEAL', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "LeadIntegrationSource" AS ENUM ('GENERIC_WEBHOOK', 'ZAPIER', 'MAKE', 'N8N', 'HUBSPOT', 'RD_STATION');

-- CreateEnum
CREATE TYPE "LeadIntegrationEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'DUPLICATE');

-- CreateTable
CREATE TABLE "Lead" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "externalSource" "LeadIntegrationSource",
  "externalId" TEXT,
  "captureSource" "LeadSource" NOT NULL DEFAULT 'MANUAL',
  "status" "LeadStatus" NOT NULL DEFAULT 'CAPTURED',
  "qualificationStatus" "LeadQualificationStatus" NOT NULL DEFAULT 'UNQUALIFIED',
  "distributionStatus" "LeadDistributionStatus" NOT NULL DEFAULT 'UNASSIGNED',
  "score" INTEGER NOT NULL DEFAULT 0,
  "temperature" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  "fullName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "companyName" TEXT,
  "jobTitle" TEXT,
  "website" TEXT,
  "city" TEXT,
  "state" TEXT,
  "country" TEXT,
  "interest" TEXT,
  "notes" TEXT,
  "tags" JSONB,
  "ownerUserId" TEXT,
  "estimatedValue" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "qualifiedAt" TIMESTAMP(3),
  "distributedAt" TIMESTAMP(3),
  "lastContactAt" TIMESTAMP(3),
  "nextFollowUpAt" TIMESTAMP(3),
  "nurturingStartedAt" TIMESTAMP(3),
  "convertedAt" TIMESTAMP(3),
  "lostAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "type" "LeadActivityType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "payload" JSONB,
  "actorUserId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadAssignment" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "fromUserId" TEXT,
  "toUserId" TEXT,
  "strategy" "LeadDistributionStrategy" NOT NULL DEFAULT 'MANUAL',
  "reason" TEXT,
  "assignedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadNurtureTouch" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "status" "LeadNurtureStatus" NOT NULL DEFAULT 'DRAFT',
  "channel" TEXT NOT NULL,
  "templateKey" TEXT,
  "subject" TEXT,
  "message" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "respondedAt" TIMESTAMP(3),
  "providerMessageId" TEXT,
  "errorMessage" TEXT,
  "metadata" JSONB,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadNurtureTouch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadConversion" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "conversionType" "LeadConversionType" NOT NULL DEFAULT 'CUSTOMER',
  "conversionRef" TEXT NOT NULL,
  "amount" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "notes" TEXT,
  "convertedByUserId" TEXT,
  "convertedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadIntegrationEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "leadId" TEXT,
  "source" "LeadIntegrationSource" NOT NULL DEFAULT 'GENERIC_WEBHOOK',
  "eventType" TEXT NOT NULL,
  "providerEventId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "status" "LeadIntegrationEventStatus" NOT NULL DEFAULT 'RECEIVED',
  "headers" JSONB,
  "payload" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadIntegrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_workspaceId_externalSource_externalId_key" ON "Lead"("workspaceId", "externalSource", "externalId");
CREATE INDEX "Lead_workspaceId_status_createdAt_idx" ON "Lead"("workspaceId", "status", "createdAt");
CREATE INDEX "Lead_workspaceId_qualificationStatus_distributionStatus_create_idx" ON "Lead"("workspaceId", "qualificationStatus", "distributionStatus", "createdAt");
CREATE INDEX "Lead_workspaceId_ownerUserId_nextFollowUpAt_idx" ON "Lead"("workspaceId", "ownerUserId", "nextFollowUpAt");
CREATE INDEX "Lead_workspaceId_email_phone_idx" ON "Lead"("workspaceId", "email", "phone");

CREATE INDEX "LeadActivity_workspaceId_leadId_occurredAt_idx" ON "LeadActivity"("workspaceId", "leadId", "occurredAt");
CREATE INDEX "LeadActivity_workspaceId_type_occurredAt_idx" ON "LeadActivity"("workspaceId", "type", "occurredAt");

CREATE INDEX "LeadAssignment_workspaceId_leadId_createdAt_idx" ON "LeadAssignment"("workspaceId", "leadId", "createdAt");
CREATE INDEX "LeadAssignment_workspaceId_toUserId_createdAt_idx" ON "LeadAssignment"("workspaceId", "toUserId", "createdAt");

CREATE INDEX "LeadNurtureTouch_workspaceId_leadId_status_createdAt_idx" ON "LeadNurtureTouch"("workspaceId", "leadId", "status", "createdAt");
CREATE INDEX "LeadNurtureTouch_workspaceId_scheduledAt_idx" ON "LeadNurtureTouch"("workspaceId", "scheduledAt");

CREATE UNIQUE INDEX "LeadConversion_leadId_key" ON "LeadConversion"("leadId");
CREATE INDEX "LeadConversion_workspaceId_conversionType_convertedAt_idx" ON "LeadConversion"("workspaceId", "conversionType", "convertedAt");

CREATE UNIQUE INDEX "LeadIntegrationEvent_idempotencyKey_key" ON "LeadIntegrationEvent"("idempotencyKey");
CREATE INDEX "LeadIntegrationEvent_workspaceId_status_createdAt_idx" ON "LeadIntegrationEvent"("workspaceId", "status", "createdAt");
CREATE INDEX "LeadIntegrationEvent_source_eventType_createdAt_idx" ON "LeadIntegrationEvent"("source", "eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_assignedByUserId_fkey"
  FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadNurtureTouch" ADD CONSTRAINT "LeadNurtureTouch_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadNurtureTouch" ADD CONSTRAINT "LeadNurtureTouch_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadNurtureTouch" ADD CONSTRAINT "LeadNurtureTouch_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadConversion" ADD CONSTRAINT "LeadConversion_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadConversion" ADD CONSTRAINT "LeadConversion_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadConversion" ADD CONSTRAINT "LeadConversion_convertedByUserId_fkey"
  FOREIGN KEY ("convertedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadIntegrationEvent" ADD CONSTRAINT "LeadIntegrationEvent_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeadIntegrationEvent" ADD CONSTRAINT "LeadIntegrationEvent_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
