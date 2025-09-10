/*
  Warnings:

  - A unique constraint covering the columns `[jobId]` on the table `BulkProcessingRequest` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "BulkProcessingStatus" ADD VALUE 'CANCELLING';

-- CreateIndex
CREATE UNIQUE INDEX "BulkProcessingRequest_jobId_key" ON "BulkProcessingRequest"("jobId");
