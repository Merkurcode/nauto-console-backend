/*
  Warnings:

  - You are about to drop the column `lastReminderProcessedId` on the `ClientReminderQueue` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ClientReminderQueue" DROP CONSTRAINT "ClientReminderQueue_lastReminderProcessedId_fkey";

-- AlterTable
ALTER TABLE "ClientReminderQueue" DROP COLUMN "lastReminderProcessedId";

-- CreateIndex
CREATE INDEX "ClientReminder_clientReminderQueueId_sentLastDay_idx" ON "ClientReminder"("clientReminderQueueId", "sentLastDay");
