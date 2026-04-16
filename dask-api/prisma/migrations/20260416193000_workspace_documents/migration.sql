-- CreateTable
CREATE TABLE "WorkspaceDocument" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceDocument_workspaceId_updatedAt_idx" ON "WorkspaceDocument"("workspaceId", "updatedAt");

-- CreateIndex
CREATE INDEX "WorkspaceDocument_workspaceId_position_idx" ON "WorkspaceDocument"("workspaceId", "position");

-- AddForeignKey
ALTER TABLE "WorkspaceDocument" ADD CONSTRAINT "WorkspaceDocument_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
