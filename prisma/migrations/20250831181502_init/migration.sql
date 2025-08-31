-- CreateTable
CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "utmName" VARCHAR(255) NOT NULL,
    "referenceName" VARCHAR(255) NOT NULL,
    "context" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "metaId" VARCHAR(255),
    "promotionPictureId" TEXT,
    "companyId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingCampaign_utmName_key" ON "MarketingCampaign"("utmName");

-- CreateIndex
CREATE INDEX "MarketingCampaign_companyId_idx" ON "MarketingCampaign"("companyId");

-- CreateIndex
CREATE INDEX "MarketingCampaign_enabled_idx" ON "MarketingCampaign"("enabled");

-- CreateIndex
CREATE INDEX "MarketingCampaign_startDate_endDate_idx" ON "MarketingCampaign"("startDate", "endDate");

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_promotionPictureId_fkey" FOREIGN KEY ("promotionPictureId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
