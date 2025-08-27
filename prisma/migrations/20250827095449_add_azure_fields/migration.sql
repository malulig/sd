/*
  Warnings:

  - A unique constraint covering the columns `[azureId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `user` ADD COLUMN `avatarUrl` VARCHAR(191) NULL,
    ADD COLUMN `azureId` VARCHAR(191) NULL,
    ADD COLUMN `azureTenantId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_azureId_key` ON `User`(`azureId`);

-- CreateIndex
CREATE INDEX `User_azureTenantId_idx` ON `User`(`azureTenantId`);
