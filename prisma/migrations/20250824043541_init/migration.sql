-- CreateIndex
CREATE INDEX "File_userId_status_idx" ON "File"("userId", "status");

-- CreateIndex
CREATE INDEX "File_userId_bucket_idx" ON "File"("userId", "bucket");
