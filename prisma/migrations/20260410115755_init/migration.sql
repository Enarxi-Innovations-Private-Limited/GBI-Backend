-- CreateEnum
CREATE TYPE "PremiumStatus" AS ENUM ('FREE', 'PREMIUM', 'EXPIRED', 'REVOKED', 'TRIAL');

-- CreateEnum
CREATE TYPE "PremiumActionType" AS ENUM ('ACTIVATE', 'RENEW', 'REVOKE');

-- DropIndex
DROP INDEX "DeviceAssignment_userId_idx";

-- DropIndex
DROP INDEX "RefreshToken_userId_idx";

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "thresholdValue" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isPremium" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "premiumExpiry" TIMESTAMP(3),
ADD COLUMN     "premiumStatus" "PremiumStatus" NOT NULL DEFAULT 'FREE';

-- CreateTable
CREATE TABLE "PremiumSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activatedByAdminId" TEXT,
    "activationDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "status" "SubStatus" NOT NULL DEFAULT 'ACTIVE',
    "revokedByAdminId" TEXT,
    "revokedReason" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PremiumSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PremiumHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" "PremiumActionType" NOT NULL,
    "previousExpiry" TIMESTAMP(3),
    "newExpiry" TIMESTAMP(3),
    "adminId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PremiumHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PremiumSubscription_userId_idx" ON "PremiumSubscription"("userId");

-- CreateIndex
CREATE INDEX "PremiumSubscription_status_idx" ON "PremiumSubscription"("status");

-- CreateIndex
CREATE INDEX "PremiumSubscription_expiryDate_idx" ON "PremiumSubscription"("expiryDate");

-- CreateIndex
CREATE INDEX "PremiumHistory_userId_idx" ON "PremiumHistory"("userId");

-- CreateIndex
CREATE INDEX "PremiumHistory_adminId_idx" ON "PremiumHistory"("adminId");

-- CreateIndex
CREATE INDEX "DeviceAssignment_userId_unassignedAt_idx" ON "DeviceAssignment"("userId", "unassignedAt");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_expiresAt_idx" ON "RefreshToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_revokedAt_idx" ON "RefreshToken"("userId", "revokedAt");

-- AddForeignKey
ALTER TABLE "PremiumSubscription" ADD CONSTRAINT "PremiumSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremiumHistory" ADD CONSTRAINT "PremiumHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
