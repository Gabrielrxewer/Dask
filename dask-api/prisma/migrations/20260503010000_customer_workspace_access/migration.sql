-- Add a customer-facing workspace role and an explicit customer/user/workspace scope.
ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'CLIENT';

CREATE TABLE "WorkspaceCustomerUser" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceCustomerUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceCustomerUser_workspaceId_customerId_userId_key"
  ON "WorkspaceCustomerUser"("workspaceId", "customerId", "userId");

CREATE INDEX "WorkspaceCustomerUser_workspaceId_userId_idx"
  ON "WorkspaceCustomerUser"("workspaceId", "userId");

CREATE INDEX "WorkspaceCustomerUser_workspaceId_customerId_idx"
  ON "WorkspaceCustomerUser"("workspaceId", "customerId");

ALTER TABLE "WorkspaceCustomerUser"
  ADD CONSTRAINT "WorkspaceCustomerUser_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceCustomerUser"
  ADD CONSTRAINT "WorkspaceCustomerUser_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceCustomerUser"
  ADD CONSTRAINT "WorkspaceCustomerUser_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
