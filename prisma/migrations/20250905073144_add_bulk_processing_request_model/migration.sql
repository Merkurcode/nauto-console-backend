-- CreateEnum
CREATE TYPE "BulkProcessingType" AS ENUM ('PRODUCT_CATALOG', 'USER_BULK');

-- CreateEnum
CREATE TYPE "BulkProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "BulkProcessingRequest" (
    "id" TEXT NOT NULL,
    "type" "BulkProcessingType" NOT NULL,
    "fileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "BulkProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "successfulRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "rowLogs" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "companyId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkProcessingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulkProcessingRequest_companyId_status_idx" ON "BulkProcessingRequest"("companyId", "status");

-- CreateIndex
CREATE INDEX "BulkProcessingRequest_companyId_type_idx" ON "BulkProcessingRequest"("companyId", "type");

-- CreateIndex
CREATE INDEX "BulkProcessingRequest_companyId_requestedBy_idx" ON "BulkProcessingRequest"("companyId", "requestedBy");

-- CreateIndex
CREATE INDEX "BulkProcessingRequest_companyId_createdAt_idx" ON "BulkProcessingRequest"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "BulkProcessingRequest" ADD CONSTRAINT "BulkProcessingRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkProcessingRequest" ADD CONSTRAINT "BulkProcessingRequest_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkProcessingRequest" ADD CONSTRAINT "BulkProcessingRequest_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
