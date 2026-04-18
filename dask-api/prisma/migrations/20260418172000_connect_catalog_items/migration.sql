-- CreateEnum
CREATE TYPE "ConnectCatalogItemKind" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateTable
CREATE TABLE "ConnectCatalogItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "kind" "ConnectCatalogItemKind" NOT NULL DEFAULT 'SERVICE',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'brl',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConnectCatalogItem_workspaceId_isActive_createdAt_idx" ON "ConnectCatalogItem"("workspaceId", "isActive", "createdAt");

-- AddForeignKey
ALTER TABLE "ConnectCatalogItem" ADD CONSTRAINT "ConnectCatalogItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
