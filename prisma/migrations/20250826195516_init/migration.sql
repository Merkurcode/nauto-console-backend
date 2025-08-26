-- CreateIndex
CREATE INDEX "File_path_bucket_storageDriver_idx" ON "File"("path", "bucket", "storageDriver");
