/*
  Warnings:

  - You are about to drop the column `lastHeartbeatAt` on the `DeviceAssignment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "lastHeartbeatAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DeviceAssignment" DROP COLUMN "lastHeartbeatAt";
