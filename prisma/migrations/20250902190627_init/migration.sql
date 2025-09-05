-- CreateEnum
CREATE TYPE "PaymentOption" AS ENUM ('FINANCING', 'CREDIT', 'CASH');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'OTHER');

-- CreateTable
CREATE TABLE "ProductCatalog" (
    "id" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "productService" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subcategory" TEXT NOT NULL,
    "listPrice" DECIMAL(10,2) NOT NULL,
    "paymentOptions" "PaymentOption"[],
    "description" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMedia" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "fav" BOOLEAN NOT NULL DEFAULT false,
    "productId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductCatalog_companyId_idx" ON "ProductCatalog"("companyId");

-- CreateIndex
CREATE INDEX "ProductCatalog_industry_idx" ON "ProductCatalog"("industry");

-- CreateIndex
CREATE INDEX "ProductCatalog_type_idx" ON "ProductCatalog"("type");

-- CreateIndex
CREATE INDEX "ProductCatalog_subcategory_idx" ON "ProductCatalog"("subcategory");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCatalog_id_companyId_key" ON "ProductCatalog"("id", "companyId");

-- CreateIndex
CREATE INDEX "ProductMedia_productId_companyId_idx" ON "ProductMedia"("productId", "companyId");

-- CreateIndex
CREATE INDEX "ProductMedia_productId_idx" ON "ProductMedia"("productId");

-- CreateIndex
CREATE INDEX "ProductMedia_fileId_idx" ON "ProductMedia"("fileId");

-- CreateIndex
CREATE INDEX "ProductMedia_createdBy_idx" ON "ProductMedia"("createdBy");

-- CreateIndex
CREATE INDEX "ProductMedia_fileType_idx" ON "ProductMedia"("fileType");

-- AddForeignKey
ALTER TABLE "ProductCatalog" ADD CONSTRAINT "ProductCatalog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_productId_companyId_fkey" FOREIGN KEY ("productId", "companyId") REFERENCES "ProductCatalog"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
