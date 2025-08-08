-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "googleMapsUrl" TEXT;

-- CreateTable
CREATE TABLE "BotToken" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "botUserId" TEXT NOT NULL,
    "botEmail" TEXT NOT NULL,
    "companyId" TEXT,
    "issuedBy" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BotToken_tokenId_key" ON "BotToken"("tokenId");

-- CreateIndex
CREATE INDEX "BotToken_tokenId_idx" ON "BotToken"("tokenId");

-- CreateIndex
CREATE INDEX "BotToken_botUserId_isActive_idx" ON "BotToken"("botUserId", "isActive");

-- CreateIndex
CREATE INDEX "BotToken_companyId_isActive_idx" ON "BotToken"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "BotToken_isActive_revokedAt_idx" ON "BotToken"("isActive", "revokedAt");

-- CreateIndex
CREATE INDEX "BotToken_issuedBy_issuedAt_idx" ON "BotToken"("issuedBy", "issuedAt");

-- AddForeignKey
ALTER TABLE "BotToken" ADD CONSTRAINT "BotToken_botUserId_fkey" FOREIGN KEY ("botUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotToken" ADD CONSTRAINT "BotToken_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotToken" ADD CONSTRAINT "BotToken_issuedBy_fkey" FOREIGN KEY ("issuedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotToken" ADD CONSTRAINT "BotToken_revokedBy_fkey" FOREIGN KEY ("revokedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
