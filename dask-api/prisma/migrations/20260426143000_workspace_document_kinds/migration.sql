ALTER TABLE "WorkspaceDocument"
ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'wiki',
ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "metadata" JSONB;

CREATE INDEX "WorkspaceDocument_workspaceId_kind_updatedAt_idx" ON "WorkspaceDocument"("workspaceId", "kind", "updatedAt");
