-- CreateEnum
CREATE TYPE "FiscalProvider" AS ENUM ('FOCUS');

-- CreateEnum
CREATE TYPE "FiscalDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "FiscalDocumentType" AS ENUM ('NFE', 'NFSE');

-- CreateEnum
CREATE TYPE "FiscalDocumentOrigin" AS ENUM (
  'MANUAL_PRODUCT',
  'MANUAL_SERVICE',
  'CATALOG_PRODUCT',
  'CATALOG_SERVICE',
  'STRIPE_PAYMENT',
  'STRIPE_SUBSCRIPTION',
  'EXTERNAL_RECEIVED_NFE',
  'EXTERNAL_RECEIVED_NFSE'
);

-- CreateEnum
CREATE TYPE "FiscalSourceSystem" AS ENUM ('INTERNAL', 'STRIPE', 'FOCUS', 'MDE', 'NFSER');

-- CreateEnum
CREATE TYPE "FiscalDocumentStatus" AS ENUM (
  'DRAFT',
  'READY_TO_ISSUE',
  'ISSUING',
  'AUTHORIZED',
  'PROCESSING',
  'PENDING_REVIEW',
  'REJECTED',
  'CANCELLED',
  'FAILED',
  'RECEIVED',
  'MANIFEST_PENDING',
  'MANIFESTED',
  'SYNCED'
);

-- CreateEnum
CREATE TYPE "FiscalIssueStatus" AS ENUM (
  'NOT_STARTED',
  'PROCESSING',
  'AUTHORIZED',
  'REJECTED',
  'CANCELLED',
  'FAILED'
);

-- CreateEnum
CREATE TYPE "FiscalPartyRole" AS ENUM ('EMITTER', 'RECIPIENT', 'TAKER', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "FiscalReceivedType" AS ENUM ('NFE_MDE', 'NFSE_NFSER');

-- CreateEnum
CREATE TYPE "FiscalReceivedStatus" AS ENUM (
  'RECEIVED',
  'MANIFEST_PENDING',
  'MANIFESTED',
  'SYNCED',
  'FAILED'
);

-- CreateEnum
CREATE TYPE "FiscalSyncType" AS ENUM ('RECEIVED_NFE', 'RECEIVED_NFSE', 'PENDING_RECONCILIATION', 'OUTBOUND_STATUS');

-- CreateEnum
CREATE TYPE "FiscalSyncTrigger" AS ENUM ('MANUAL', 'SCHEDULED', 'WEBHOOK', 'RETRY');

-- CreateEnum
CREATE TYPE "FiscalSyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "FiscalWebhookSource" AS ENUM ('FOCUS', 'STRIPE');

-- CreateEnum
CREATE TYPE "FiscalWebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "FiscalCatalogItemType" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateEnum
CREATE TYPE "FiscalDraftStatus" AS ENUM ('DRAFT', 'READY', 'ISSUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FiscalIntegrationDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "FiscalIntegrationStatus" AS ENUM ('SUCCESS', 'ERROR');

-- CreateTable
CREATE TABLE "FiscalCompanyConfig" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workspaceBusinessId" TEXT,
    "provider" "FiscalProvider" NOT NULL DEFAULT 'FOCUS',
    "displayName" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "stateRegistration" TEXT,
    "municipalRegistration" TEXT,
    "taxRegime" TEXT,
    "focusToken" TEXT NOT NULL,
    "focusEnvironment" TEXT NOT NULL DEFAULT 'homologacao',
    "focusCompanyReference" TEXT,
    "focusWebhookSecret" TEXT,
    "emitAutomatically" BOOLEAN NOT NULL DEFAULT false,
    "stripePolicy" TEXT NOT NULL DEFAULT 'assisted_one_click',
    "defaultSerie" TEXT,
    "defaultNatureOperation" TEXT,
    "fallbackRules" JSONB,
    "syncConfig" JSONB,
    "metadata" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FiscalCompanyConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalDocument" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workspaceBusinessId" TEXT,
    "companyConfigId" TEXT,
    "internalReference" TEXT NOT NULL,
    "provider" "FiscalProvider" NOT NULL DEFAULT 'FOCUS',
    "direction" "FiscalDirection" NOT NULL,
    "documentType" "FiscalDocumentType" NOT NULL,
    "origin" "FiscalDocumentOrigin" NOT NULL,
    "sourceSystem" "FiscalSourceSystem" NOT NULL DEFAULT 'INTERNAL',
    "status" "FiscalDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "issueStatus" "FiscalIssueStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "focusStatus" TEXT,
    "operationStatus" TEXT,
    "customerId" TEXT,
    "supplierId" TEXT,
    "saleId" TEXT,
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "stripeAccountId" TEXT,
    "focusReference" TEXT,
    "focusDocumentId" TEXT,
    "number" TEXT,
    "series" TEXT,
    "amountSubtotal" DECIMAL(18,4),
    "amountDiscount" DECIMAL(18,4),
    "amountTotal" DECIMAL(18,4),
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "issuedAt" TIMESTAMP(3),
    "authorizedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "xmlUrl" TEXT,
    "pdfUrl" TEXT,
    "xmlStorageRef" TEXT,
    "pdfStorageRef" TEXT,
    "requestPayloadSnapshot" JSONB,
    "responsePayloadSnapshot" JSONB,
    "providerPayloadRaw" JSONB,
    "metadata" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FiscalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalDocumentItem" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "itemType" "FiscalCatalogItemType" NOT NULL,
    "sourceType" TEXT,
    "catalogProfileId" TEXT,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "descriptionCommercial" TEXT,
    "descriptionFiscal" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit" TEXT,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "discountAmount" DECIMAL(18,4),
    "totalAmount" DECIMAL(18,4) NOT NULL,
    "taxConfigSnapshot" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FiscalDocumentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalParty" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "role" "FiscalPartyRole" NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "cnpjCpf" TEXT NOT NULL,
    "stateRegistration" TEXT,
    "municipalRegistration" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FiscalParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalEmissionDraft" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workspaceBusinessId" TEXT,
    "companyConfigId" TEXT,
    "status" "FiscalDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "documentType" "FiscalDocumentType" NOT NULL,
    "origin" "FiscalDocumentOrigin" NOT NULL,
    "saleId" TEXT,
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "emitAfterPayment" BOOLEAN NOT NULL DEFAULT false,
    "autoIssueEligible" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "suggestion" JSONB,
    "createdByUserId" TEXT,
    "issuedDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FiscalEmissionDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalReceivedDocument" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workspaceBusinessId" TEXT,
    "companyConfigId" TEXT,
    "type" "FiscalReceivedType" NOT NULL,
    "status" "FiscalReceivedStatus" NOT NULL DEFAULT 'RECEIVED',
    "manifestationStatus" TEXT,
    "externalKey" TEXT NOT NULL,
    "providerReference" TEXT,
    "focusReference" TEXT,
    "issuerName" TEXT,
    "issuerDocument" TEXT,
    "recipientDocument" TEXT,
    "amountTotal" DECIMAL(18,4),
    "issuedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "xmlUrl" TEXT,
    "pdfUrl" TEXT,
    "payload" JSONB,
    "supplierId" TEXT,
    "costCenterId" TEXT,
    "categoryId" TEXT,
    "financialEntryId" TEXT,
    "purchaseId" TEXT,
    "mappedDocumentId" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FiscalReceivedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalSyncRun" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workspaceBusinessId" TEXT,
    "companyConfigId" TEXT,
    "syncType" "FiscalSyncType" NOT NULL,
    "trigger" "FiscalSyncTrigger" NOT NULL,
    "status" "FiscalSyncStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "requestSnapshot" JSONB,
    "responseSnapshot" JSONB,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FiscalSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalWebhookEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "source" "FiscalWebhookSource" NOT NULL,
    "providerEventId" TEXT,
    "eventType" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "FiscalWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "headers" JSONB,
    "payload" JSONB NOT NULL,
    "signature" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FiscalWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalIntegrationLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "companyConfigId" TEXT,
    "documentId" TEXT,
    "system" "FiscalWebhookSource" NOT NULL,
    "direction" "FiscalIntegrationDirection" NOT NULL,
    "operation" TEXT NOT NULL,
    "status" "FiscalIntegrationStatus" NOT NULL,
    "correlationId" TEXT,
    "httpStatus" INTEGER,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FiscalIntegrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalCatalogProfile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workspaceBusinessId" TEXT,
    "itemType" "FiscalCatalogItemType" NOT NULL,
    "name" TEXT NOT NULL,
    "descriptionCommercial" TEXT,
    "descriptionFiscal" TEXT,
    "sku" TEXT,
    "unit" TEXT,
    "defaultValue" DECIMAL(18,4),
    "ncm" TEXT,
    "serviceCode" TEXT,
    "cnae" TEXT,
    "lcItem" TEXT,
    "cfopDefault" TEXT,
    "operationNature" TEXT,
    "taxConfig" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FiscalCatalogProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalOperationTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workspaceBusinessId" TEXT,
    "name" TEXT NOT NULL,
    "documentType" "FiscalDocumentType" NOT NULL,
    "itemType" "FiscalCatalogItemType",
    "serie" TEXT,
    "natureOperation" TEXT,
    "cfop" TEXT,
    "taxDefaults" JSONB,
    "notes" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FiscalOperationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FiscalCompanyConfig_workspaceId_cnpj_key" ON "FiscalCompanyConfig"("workspaceId", "cnpj");
CREATE INDEX "FiscalCompanyConfig_workspaceId_workspaceBusinessId_createdAt_idx" ON "FiscalCompanyConfig"("workspaceId", "workspaceBusinessId", "createdAt");

CREATE UNIQUE INDEX "FiscalDocument_workspaceId_internalReference_key" ON "FiscalDocument"("workspaceId", "internalReference");
CREATE INDEX "FiscalDocument_workspaceId_workspaceBusinessId_direction_documentT_idx" ON "FiscalDocument"("workspaceId", "workspaceBusinessId", "direction", "documentType", "createdAt");
CREATE INDEX "FiscalDocument_workspaceId_status_issueStatus_createdAt_idx" ON "FiscalDocument"("workspaceId", "status", "issueStatus", "createdAt");
CREATE INDEX "FiscalDocument_workspaceId_saleId_stripeSessionId_idx" ON "FiscalDocument"("workspaceId", "saleId", "stripeSessionId");
CREATE INDEX "FiscalDocument_focusReference_focusDocumentId_idx" ON "FiscalDocument"("focusReference", "focusDocumentId");

CREATE INDEX "FiscalDocumentItem_documentId_createdAt_idx" ON "FiscalDocumentItem"("documentId", "createdAt");
CREATE INDEX "FiscalParty_documentId_role_idx" ON "FiscalParty"("documentId", "role");
CREATE INDEX "FiscalParty_cnpjCpf_idx" ON "FiscalParty"("cnpjCpf");
CREATE INDEX "FiscalEmissionDraft_workspaceId_workspaceBusinessId_status_create_idx" ON "FiscalEmissionDraft"("workspaceId", "workspaceBusinessId", "status", "createdAt");
CREATE INDEX "FiscalEmissionDraft_workspaceId_saleId_stripeSessionId_idx" ON "FiscalEmissionDraft"("workspaceId", "saleId", "stripeSessionId");

CREATE UNIQUE INDEX "FiscalReceivedDocument_workspaceId_type_externalKey_key" ON "FiscalReceivedDocument"("workspaceId", "type", "externalKey");
CREATE INDEX "FiscalReceivedDocument_workspaceId_workspaceBusinessId_type_statu_idx" ON "FiscalReceivedDocument"("workspaceId", "workspaceBusinessId", "type", "status", "createdAt");
CREATE INDEX "FiscalReceivedDocument_workspaceId_manifestationStatus_idx" ON "FiscalReceivedDocument"("workspaceId", "manifestationStatus");

CREATE INDEX "FiscalSyncRun_workspaceId_workspaceBusinessId_syncType_status_s_idx" ON "FiscalSyncRun"("workspaceId", "workspaceBusinessId", "syncType", "status", "startedAt");

CREATE UNIQUE INDEX "FiscalWebhookEvent_idempotencyKey_key" ON "FiscalWebhookEvent"("idempotencyKey");
CREATE INDEX "FiscalWebhookEvent_source_eventType_createdAt_idx" ON "FiscalWebhookEvent"("source", "eventType", "createdAt");
CREATE INDEX "FiscalWebhookEvent_workspaceId_status_createdAt_idx" ON "FiscalWebhookEvent"("workspaceId", "status", "createdAt");

CREATE INDEX "FiscalIntegrationLog_workspaceId_system_status_createdAt_idx" ON "FiscalIntegrationLog"("workspaceId", "system", "status", "createdAt");
CREATE INDEX "FiscalIntegrationLog_documentId_createdAt_idx" ON "FiscalIntegrationLog"("documentId", "createdAt");

CREATE INDEX "FiscalCatalogProfile_workspaceId_workspaceBusinessId_itemType_isA_idx" ON "FiscalCatalogProfile"("workspaceId", "workspaceBusinessId", "itemType", "isActive", "createdAt");
CREATE INDEX "FiscalCatalogProfile_workspaceId_sku_idx" ON "FiscalCatalogProfile"("workspaceId", "sku");

CREATE INDEX "FiscalOperationTemplate_workspaceId_workspaceBusinessId_document_idx" ON "FiscalOperationTemplate"("workspaceId", "workspaceBusinessId", "documentType", "isActive", "createdAt");

-- AddForeignKey
ALTER TABLE "FiscalCompanyConfig" ADD CONSTRAINT "FiscalCompanyConfig_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_companyConfigId_fkey"
  FOREIGN KEY ("companyConfigId") REFERENCES "FiscalCompanyConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FiscalDocumentItem" ADD CONSTRAINT "FiscalDocumentItem_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "FiscalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FiscalParty" ADD CONSTRAINT "FiscalParty_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "FiscalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FiscalEmissionDraft" ADD CONSTRAINT "FiscalEmissionDraft_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FiscalEmissionDraft" ADD CONSTRAINT "FiscalEmissionDraft_companyConfigId_fkey"
  FOREIGN KEY ("companyConfigId") REFERENCES "FiscalCompanyConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FiscalReceivedDocument" ADD CONSTRAINT "FiscalReceivedDocument_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FiscalReceivedDocument" ADD CONSTRAINT "FiscalReceivedDocument_companyConfigId_fkey"
  FOREIGN KEY ("companyConfigId") REFERENCES "FiscalCompanyConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FiscalSyncRun" ADD CONSTRAINT "FiscalSyncRun_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FiscalSyncRun" ADD CONSTRAINT "FiscalSyncRun_companyConfigId_fkey"
  FOREIGN KEY ("companyConfigId") REFERENCES "FiscalCompanyConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FiscalWebhookEvent" ADD CONSTRAINT "FiscalWebhookEvent_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FiscalIntegrationLog" ADD CONSTRAINT "FiscalIntegrationLog_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FiscalIntegrationLog" ADD CONSTRAINT "FiscalIntegrationLog_companyConfigId_fkey"
  FOREIGN KEY ("companyConfigId") REFERENCES "FiscalCompanyConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FiscalIntegrationLog" ADD CONSTRAINT "FiscalIntegrationLog_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "FiscalDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FiscalCatalogProfile" ADD CONSTRAINT "FiscalCatalogProfile_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FiscalOperationTemplate" ADD CONSTRAINT "FiscalOperationTemplate_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
