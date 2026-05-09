CREATE TABLE "WorkspaceDocumentFolder" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceDocumentFolder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkspaceDocumentFolder_workspaceId_parentId_position_idx"
ON "WorkspaceDocumentFolder"("workspaceId", "parentId", "position");

ALTER TABLE "WorkspaceDocumentFolder"
ADD CONSTRAINT "WorkspaceDocumentFolder_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceDocumentFolder"
ADD CONSTRAINT "WorkspaceDocumentFolder_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "WorkspaceDocumentFolder"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
