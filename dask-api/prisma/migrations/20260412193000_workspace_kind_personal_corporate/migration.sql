-- CreateEnum
CREATE TYPE "WorkspaceKind" AS ENUM ('PERSONAL', 'CORPORATE');

-- AlterTable
ALTER TABLE "Workspace"
ADD COLUMN "kind" "WorkspaceKind" NOT NULL DEFAULT 'CORPORATE',
ALTER COLUMN "organizationId" DROP NOT NULL;

-- Enforce workspace ownership model:
-- PERSONAL  => no organization
-- CORPORATE => organization required
ALTER TABLE "Workspace"
ADD CONSTRAINT "Workspace_kind_organization_check"
CHECK (
  ("kind" = 'PERSONAL' AND "organizationId" IS NULL)
  OR
  ("kind" = 'CORPORATE' AND "organizationId" IS NOT NULL)
);
