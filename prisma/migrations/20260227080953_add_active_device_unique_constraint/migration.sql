-- This is an empty migration.
CREATE UNIQUE INDEX unique_active_device_assignment
ON "DeviceAssignment" ("deviceId")
WHERE "unassignedAt" IS NULL;