/*
  Warnings:

  - A unique constraint covering the columns `[alias]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "alias" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_alias_key" ON "User"("alias");
