-- CreateEnum
CREATE TYPE "ConnectPaymentOrderStatus" AS ENUM (
  'DRAFT',
  'CHECKOUT_OPEN',
  'CHECKOUT_COMPLETED',
  'PENDING',
  'PAID',
  'FAILED',
  'CANCELED',
  'REFUNDED'
);

-- CreateTable
CREATE TABLE "ConnectPaymentOrder" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "stripeConnectAccountId" TEXT NOT NULL,
  "stripeCheckoutSessionId" TEXT,
  "stripePaymentIntentId" TEXT,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'brl',
  "description" TEXT NOT NULL,
  "customerEmail" TEXT,
  "applicationFeeAmount" INTEGER NOT NULL,
  "status" "ConnectPaymentOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "statusReason" TEXT,
  "metadata" JSONB,
  "checkoutUrl" TEXT,
  "lastWebhookEvent" TEXT,
  "paidAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "refundedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConnectPaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectPaymentOrder_stripeCheckoutSessionId_key" ON "ConnectPaymentOrder"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectPaymentOrder_stripePaymentIntentId_key" ON "ConnectPaymentOrder"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "ConnectPaymentOrder_workspaceId_createdAt_idx" ON "ConnectPaymentOrder"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "ConnectPaymentOrder_status_createdAt_idx" ON "ConnectPaymentOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ConnectPaymentOrder_stripeConnectAccountId_createdAt_idx" ON "ConnectPaymentOrder"("stripeConnectAccountId", "createdAt");

-- AddForeignKey
ALTER TABLE "ConnectPaymentOrder"
ADD CONSTRAINT "ConnectPaymentOrder_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
