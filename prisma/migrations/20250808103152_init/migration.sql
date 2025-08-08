/*
  Warnings:

  - A unique constraint covering the columns `[sessionTokenId]` on the table `BotToken` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sessionTokenId` to the `BotToken` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BotToken" ADD COLUMN     "sessionTokenId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "BotToken_sessionTokenId_key" ON "BotToken"("sessionTokenId");
