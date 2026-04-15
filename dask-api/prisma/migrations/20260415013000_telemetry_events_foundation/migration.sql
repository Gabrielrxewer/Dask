CREATE TABLE "TelemetryEvent" (
  "id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "eventName" TEXT NOT NULL,
  "success" BOOLEAN,
  "userId" TEXT,
  "workspaceId" TEXT,
  "method" TEXT,
  "route" TEXT,
  "statusCode" INTEGER,
  "durationMs" INTEGER,
  "reason" TEXT,
  "provider" TEXT,
  "ipHash" TEXT,
  "country" TEXT,
  "city" TEXT,
  "userAgent" TEXT,
  "browser" TEXT,
  "os" TEXT,
  "deviceType" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelemetryEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TelemetryEvent_category_eventName_occurredAt_idx"
ON "TelemetryEvent"("category", "eventName", "occurredAt");

CREATE INDEX "TelemetryEvent_userId_occurredAt_idx"
ON "TelemetryEvent"("userId", "occurredAt");

CREATE INDEX "TelemetryEvent_workspaceId_occurredAt_idx"
ON "TelemetryEvent"("workspaceId", "occurredAt");

CREATE INDEX "TelemetryEvent_route_occurredAt_idx"
ON "TelemetryEvent"("route", "occurredAt");
