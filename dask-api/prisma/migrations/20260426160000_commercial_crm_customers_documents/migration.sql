-- Commercial CRM foundation: Customer master data and direct document entity links.

CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tradeName" TEXT,
    "legalName" TEXT,
    "document" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "address" JSONB,
    "status" TEXT NOT NULL DEFAULT 'prospect',
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorkspaceDocument"
ADD COLUMN "linkedEntityType" TEXT,
ADD COLUMN "linkedEntityId" TEXT;

ALTER TABLE "CustomFieldDefinition"
ADD COLUMN "variableKey" TEXT,
ADD COLUMN "variableLabel" TEXT,
ADD COLUMN "variableDescription" TEXT;

CREATE INDEX "Customer_workspaceId_status_updatedAt_idx" ON "Customer"("workspaceId", "status", "updatedAt");
CREATE INDEX "Customer_workspaceId_name_idx" ON "Customer"("workspaceId", "name");
CREATE INDEX "Customer_workspaceId_email_idx" ON "Customer"("workspaceId", "email");
CREATE INDEX "Customer_workspaceId_phone_idx" ON "Customer"("workspaceId", "phone");
CREATE INDEX "Customer_workspaceId_document_idx" ON "Customer"("workspaceId", "document");
CREATE UNIQUE INDEX "CustomFieldDefinition_workspaceId_variableKey_key"
ON "CustomFieldDefinition"("workspaceId", "variableKey");

CREATE INDEX "WorkspaceDocument_workspaceId_linkedEntityType_linkedEntityId_idx"
ON "WorkspaceDocument"("workspaceId", "linkedEntityType", "linkedEntityId");

ALTER TABLE "Customer"
ADD CONSTRAINT "Customer_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
