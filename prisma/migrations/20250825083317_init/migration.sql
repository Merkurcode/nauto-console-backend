/*
  Warnings:

  - A unique constraint covering the columns `[bucket,objectKey,storageDriver]` on the table `File` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "File_bucket_objectKey_key";

-- CreateIndex
CREATE UNIQUE INDEX "File_bucket_objectKey_storageDriver_key" ON "File"("bucket", "objectKey", "storageDriver");
