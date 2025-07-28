/*
  Warnings:

  - Made the column `language` on table `Company` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Company" ALTER COLUMN "currency" SET DEFAULT 'MXN',
ALTER COLUMN "language" SET NOT NULL;
