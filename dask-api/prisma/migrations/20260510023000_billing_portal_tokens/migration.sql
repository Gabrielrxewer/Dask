CREATE TABLE "BillingPortalToken" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "tokenId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "customerEmail" TEXT,
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revokedByUserId" TEXT,
  "lastAccessedAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,

  CONSTRAINT "BillingPortalToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingPortalToken_tokenId_key" ON "BillingPortalToken"("tokenId");
CREATE UNIQUE INDEX "BillingPortalToken_tokenHash_key" ON "BillingPortalToken"("tokenHash");
CREATE INDEX "BillingPortalToken_workspaceId_orderId_createdAt_idx" ON "BillingPortalToken"("workspaceId", "orderId", "createdAt");
CREATE INDEX "BillingPortalToken_workspaceId_expiresAt_idx" ON "BillingPortalToken"("workspaceId", "expiresAt");
CREATE INDEX "BillingPortalToken_orderId_revokedAt_idx" ON "BillingPortalToken"("orderId", "revokedAt");

ALTER TABLE "BillingPortalToken"
  ADD CONSTRAINT "BillingPortalToken_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillingPortalToken"
  ADD CONSTRAINT "BillingPortalToken_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "ConnectPaymentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
