-- DropForeignKey
ALTER TABLE "BulkProcessingRequest" DROP CONSTRAINT "BulkProcessingRequest_fileId_fkey";

-- DropForeignKey
ALTER TABLE "BulkProcessingRequest" DROP CONSTRAINT "BulkProcessingRequest_requestedBy_fkey";

-- AlterTable
ALTER TABLE "BulkProcessingRequest" ALTER COLUMN "fileId" DROP NOT NULL,
ALTER COLUMN "requestedBy" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "BulkProcessingRequest" ADD CONSTRAINT "BulkProcessingRequest_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkProcessingRequest" ADD CONSTRAINT "BulkProcessingRequest_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
