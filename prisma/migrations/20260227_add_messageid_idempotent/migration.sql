-- Add messageId but allow null temporarily for existing rows
ALTER TABLE "DeviceTelemetry" ADD COLUMN "messageId" TEXT;

-- Generate a fake UUID for all 13,000+ historical rows to satisfy the non-null constraint later
UPDATE "DeviceTelemetry" SET "messageId" = gen_random_uuid()::text WHERE "messageId" IS NULL;

-- Now enforce strict NOT NULL since old rows have data
ALTER TABLE "DeviceTelemetry" ALTER COLUMN "messageId" SET NOT NULL;

-- Finally, enforce our Idempotent Architecture unique constraint
CREATE UNIQUE INDEX "DeviceTelemetry_deviceId_messageId_key" ON "DeviceTelemetry"("deviceId", "messageId");
