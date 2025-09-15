/*
  Warnings:

  - A unique constraint covering the columns `[companyId,internalName]` on the table `ClientReminderQueue` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `internalName` to the `ClientReminderQueue` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ClientReminderQueue" ADD COLUMN     "internalName" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ClientReminderQueue_companyId_internalName_key" ON "ClientReminderQueue"("companyId", "internalName");
