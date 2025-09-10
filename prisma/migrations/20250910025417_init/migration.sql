-- AlterTable
ALTER TABLE "BulkProcessingRequest" ADD COLUMN     "excelProcessingCompleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProductCatalog" ADD COLUMN     "bulkRequestId" TEXT,
ADD COLUMN     "isVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "metadata" JSONB;

-- CreateIndex
CREATE INDEX "ProductCatalog_bulkRequestId_idx" ON "ProductCatalog"("bulkRequestId");

-- CreateIndex
CREATE INDEX "ProductCatalog_isVisible_idx" ON "ProductCatalog"("isVisible");

-- AddForeignKey
ALTER TABLE "ProductCatalog" ADD CONSTRAINT "ProductCatalog_bulkRequestId_fkey" FOREIGN KEY ("bulkRequestId") REFERENCES "BulkProcessingRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
