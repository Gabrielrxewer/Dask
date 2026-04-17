-- CreateTable
CREATE TABLE "WorkItemDocumentLink" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "linkedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkItemDocumentLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkItemDocumentLink_itemId_documentId_key" ON "WorkItemDocumentLink"("itemId", "documentId");

-- CreateIndex
CREATE INDEX "WorkItemDocumentLink_workspaceId_itemId_createdAt_idx" ON "WorkItemDocumentLink"("workspaceId", "itemId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkItemDocumentLink_workspaceId_documentId_createdAt_idx" ON "WorkItemDocumentLink"("workspaceId", "documentId", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkItemDocumentLink" ADD CONSTRAINT "WorkItemDocumentLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemDocumentLink" ADD CONSTRAINT "WorkItemDocumentLink_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemDocumentLink" ADD CONSTRAINT "WorkItemDocumentLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "WorkspaceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
