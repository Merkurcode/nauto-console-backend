-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'UPLOADING', 'UPLOADED', 'FAILED', 'CANCELED', 'DELETED');

-- AlterTable
ALTER TABLE "File" ADD COLUMN     "status" "FileStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "File_status_idx" ON "File"("status");
