-- AlterTable
ALTER TABLE "File" ADD COLUMN     "storageDriver" TEXT NOT NULL DEFAULT 'minio';

-- CreateIndex
CREATE INDEX "File_storageDriver_idx" ON "File"("storageDriver");

-- CreateIndex
CREATE INDEX "File_userId_storageDriver_idx" ON "File"("userId", "storageDriver");

-- CreateIndex
CREATE INDEX "File_storageDriver_status_idx" ON "File"("storageDriver", "status");
