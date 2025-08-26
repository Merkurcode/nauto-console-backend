-- AlterTable
ALTER TABLE "File" ADD COLUMN     "targetApps" TEXT[] DEFAULT ARRAY[]::TEXT[];
