/*
  Warnings:

  - You are about to drop the column `internalName` on the `ClientReminderQueue` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[companyId,internalNameHash]` on the table `ClientReminderQueue` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `internalNameHash` to the `ClientReminderQueue` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ClientReminderQueue_companyId_internalName_key";

-- AlterTable
ALTER TABLE "ClientReminderQueue" DROP COLUMN "internalName",
ADD COLUMN     "internalNameHash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ClientReminderQueue_companyId_internalNameHash_key" ON "ClientReminderQueue"("companyId", "internalNameHash");
