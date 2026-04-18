-- CreateEnum
CREATE TYPE "ConnectCatalogBillingType" AS ENUM ('ONE_TIME', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "ConnectCatalogRecurringInterval" AS ENUM ('DAY', 'WEEK', 'MONTH', 'YEAR');

-- AlterTable
ALTER TABLE "ConnectCatalogItem"
ADD COLUMN "billingType" "ConnectCatalogBillingType" NOT NULL DEFAULT 'ONE_TIME',
ADD COLUMN "recurringInterval" "ConnectCatalogRecurringInterval",
ADD COLUMN "recurringIntervalCount" INTEGER,
ADD COLUMN "stripeConnectAccountId" TEXT,
ADD COLUMN "stripePriceId" TEXT,
ADD COLUMN "stripeProductId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ConnectCatalogItem_stripeProductId_key" ON "ConnectCatalogItem"("stripeProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectCatalogItem_stripePriceId_key" ON "ConnectCatalogItem"("stripePriceId");

-- CreateIndex
CREATE INDEX "ConnectCatalogItem_workspaceId_stripeConnectAccountId_createdAt_idx" ON "ConnectCatalogItem"("workspaceId", "stripeConnectAccountId", "createdAt");
