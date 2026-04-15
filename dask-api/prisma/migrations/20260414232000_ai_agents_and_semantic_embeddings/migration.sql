-- Add semantic embedding support on indexed search docs
ALTER TABLE "SearchDocument"
ADD COLUMN "embedding" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[];

-- Agent definitions by workspace
CREATE TABLE "AIAgent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "model" TEXT NOT NULL,
  "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
  "systemPrompt" TEXT NOT NULL,
  "config" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AIAgent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIAgentRun" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "itemId" TEXT,
  "requestedBy" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "input" JSONB NOT NULL,
  "output" JSONB,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AIAgentRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AIAgent_workspaceId_key_key" ON "AIAgent"("workspaceId", "key");
CREATE INDEX "AIAgent_workspaceId_isActive_updatedAt_idx" ON "AIAgent"("workspaceId", "isActive", "updatedAt");
CREATE INDEX "AIAgentRun_workspaceId_createdAt_idx" ON "AIAgentRun"("workspaceId", "createdAt");
CREATE INDEX "AIAgentRun_agentId_createdAt_idx" ON "AIAgentRun"("agentId", "createdAt");
CREATE INDEX "AIAgentRun_itemId_createdAt_idx" ON "AIAgentRun"("itemId", "createdAt");

ALTER TABLE "AIAgent"
ADD CONSTRAINT "AIAgent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIAgentRun"
ADD CONSTRAINT "AIAgentRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIAgentRun"
ADD CONSTRAINT "AIAgentRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AIAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIAgentRun"
ADD CONSTRAINT "AIAgentRun_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
