-- Persist documentation assets outside document metadata.
CREATE TABLE "DocumentAsset" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DocumentAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentAsset_storageKey_key" ON "DocumentAsset"("storageKey");
CREATE INDEX "DocumentAsset_workspaceId_documentId_type_createdAt_idx" ON "DocumentAsset"("workspaceId", "documentId", "type", "createdAt");
CREATE INDEX "DocumentAsset_workspaceId_storageKey_idx" ON "DocumentAsset"("workspaceId", "storageKey");

ALTER TABLE "DocumentAsset"
  ADD CONSTRAINT "DocumentAsset_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentAsset"
  ADD CONSTRAINT "DocumentAsset_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "WorkspaceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
