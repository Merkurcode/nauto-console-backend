-- CreateIndex
CREATE INDEX "idx_productcatalog_company_visible" ON "ProductCatalog"("companyId", "isVisible");

-- CreateIndex
CREATE INDEX "idx_productcatalog_company_createdat" ON "ProductCatalog"("companyId", "createdAt");
