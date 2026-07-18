-- AlterTable
ALTER TABLE "DeviceTelemetry" DROP CONSTRAINT "DeviceTelemetry_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "DeviceTelemetry_pkey" PRIMARY KEY ("deviceId", "timestamp");
