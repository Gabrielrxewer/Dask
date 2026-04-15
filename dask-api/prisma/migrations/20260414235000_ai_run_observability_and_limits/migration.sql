ALTER TABLE "AIAgentRun"
ADD COLUMN "provider" TEXT,
ADD COLUMN "model" TEXT,
ADD COLUMN "latencyMs" INTEGER,
ADD COLUMN "inputTokens" INTEGER,
ADD COLUMN "outputTokens" INTEGER,
ADD COLUMN "totalTokens" INTEGER,
ADD COLUMN "estimatedCostUsd" DOUBLE PRECISION;

CREATE INDEX "AIAgentRun_workspaceId_status_createdAt_idx"
ON "AIAgentRun"("workspaceId", "status", "createdAt");

