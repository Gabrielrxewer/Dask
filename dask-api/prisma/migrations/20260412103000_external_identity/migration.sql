-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'MICROSOFT');

-- AlterTable
ALTER TABLE "User"
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ExternalIdentity" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "AuthProvider" NOT NULL,
  "providerSubject" TEXT NOT NULL,
  "providerTenantId" TEXT,
  "emailAtProvider" TEXT,
  "emailVerified" BOOLEAN,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExternalIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalIdentity_provider_providerSubject_providerTenantId_key"
ON "ExternalIdentity"("provider", "providerSubject", "providerTenantId");

CREATE INDEX "ExternalIdentity_userId_idx"
ON "ExternalIdentity"("userId");

-- AddForeignKey
ALTER TABLE "ExternalIdentity"
ADD CONSTRAINT "ExternalIdentity_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
