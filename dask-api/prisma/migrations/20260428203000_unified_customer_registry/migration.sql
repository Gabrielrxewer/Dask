-- Unify customer data across commercial leads, billing orders, and fiscal flows.

ALTER TABLE "Customer"
ADD COLUMN "stateRegistration" TEXT,
ADD COLUMN "municipalRegistration" TEXT,
ADD COLUMN "taxRegime" TEXT;

ALTER TABLE "Lead"
ADD COLUMN "customerId" TEXT;

ALTER TABLE "ConnectPaymentOrder"
ADD COLUMN "customerId" TEXT,
ADD COLUMN "customerName" TEXT,
ADD COLUMN "customerDocument" TEXT,
ADD COLUMN "customerPhone" TEXT,
ADD COLUMN "customerAddress" JSONB;

CREATE INDEX "Lead_workspaceId_customerId_idx"
ON "Lead"("workspaceId", "customerId");

CREATE INDEX "ConnectPaymentOrder_workspaceId_customerId_createdAt_idx"
ON "ConnectPaymentOrder"("workspaceId", "customerId", "createdAt");

ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConnectPaymentOrder"
ADD CONSTRAINT "ConnectPaymentOrder_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
