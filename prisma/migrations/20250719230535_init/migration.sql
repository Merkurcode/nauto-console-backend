/*
  Warnings:

  - A unique constraint covering the columns `[host]` on the table `Company` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `host` to the `Company` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "host" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Company_host_key" ON "Company"("host");
