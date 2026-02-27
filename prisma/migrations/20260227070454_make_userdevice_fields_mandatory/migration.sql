/*
  Warnings:

  - A unique constraint covering the columns `[deviceId]` on the table `UserDevice` will be added. If there are existing duplicate values, this will fail.
  - Made the column `name` on table `UserDevice` required. This step will fail if there are existing NULL values in that column.
  - Made the column `location` on table `UserDevice` required. This step will fail if there are existing NULL values in that column.
  - Made the column `city` on table `UserDevice` required. This step will fail if there are existing NULL values in that column.
  - Made the column `pincode` on table `UserDevice` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "UserDevice_deviceId_userId_key";

-- AlterTable
ALTER TABLE "UserDevice" ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "location" SET NOT NULL,
ALTER COLUMN "city" SET NOT NULL,
ALTER COLUMN "pincode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "UserDevice_deviceId_key" ON "UserDevice"("deviceId");
