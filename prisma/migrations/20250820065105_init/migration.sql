/*
  Warnings:

  - A unique constraint covering the columns `[bucket,objectKey]` on the table `File` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `objectKey` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "File" ADD COLUMN     "etag" TEXT,
ADD COLUMN     "objectKey" TEXT NOT NULL,
ADD COLUMN     "uploadId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "File_bucket_objectKey_key" ON "File"("bucket", "objectKey");
