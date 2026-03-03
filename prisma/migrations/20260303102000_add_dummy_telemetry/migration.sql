-- CreateTable
CREATE TABLE "DummyDeviceTelemetry" (
    "id" BIGSERIAL NOT NULL,
    "deviceId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageId" TEXT NOT NULL,
    "pm25" INTEGER,
    "pm10" INTEGER,
    "tvoc" INTEGER,
    "co2" INTEGER,
    "temperature" DOUBLE PRECISION,
    "humidity" DOUBLE PRECISION,
    "noise" INTEGER,
    "aqi" INTEGER,

    CONSTRAINT "DummyDeviceTelemetry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DummyDeviceTelemetry_deviceId_messageId_key" ON "DummyDeviceTelemetry"("deviceId", "messageId");

-- CreateIndex
CREATE INDEX "DummyDeviceTelemetry_deviceId_timestamp_idx" ON "DummyDeviceTelemetry"("deviceId", "timestamp");
