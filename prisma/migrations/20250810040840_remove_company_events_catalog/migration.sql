/*
  Warnings:

  - You are about to drop the `CompanyEventsCatalog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CompanyEventsCatalog" DROP CONSTRAINT "CompanyEventsCatalog_companyId_fkey";

-- DropTable
DROP TABLE "CompanyEventsCatalog";
