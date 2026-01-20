-- CreateTable
CREATE TABLE "AlertState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "lastTriggeredAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertState_userId_idx" ON "AlertState"("userId");

-- CreateIndex
CREATE INDEX "AlertState_deviceId_idx" ON "AlertState"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertState_userId_deviceId_parameter_key" ON "AlertState"("userId", "deviceId", "parameter");
