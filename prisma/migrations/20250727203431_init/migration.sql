/*
  Warnings:

  - You are about to drop the column `country` on the `UserAddress` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `UserAddress` table. All the data in the column will be lost.
  - You are about to drop the column `countryId` on the `UserProfile` table. All the data in the column will be lost.
  - You are about to drop the column `stateId` on the `UserProfile` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[agentPhone,companyId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "EnumAssistantArea" AS ENUM ('BRAND_EXPERT', 'MARKETING_ASSISTANT', 'FINCANCE_ASSISTANT', 'UPSELL_ASSISTANT');

-- DropForeignKey
ALTER TABLE "UserProfile" DROP CONSTRAINT "UserProfile_countryId_fkey";

-- DropForeignKey
ALTER TABLE "UserProfile" DROP CONSTRAINT "UserProfile_stateId_fkey";

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "currency" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "timezone" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "agentPhone" TEXT,
ADD COLUMN     "banReason" TEXT;

-- AlterTable
ALTER TABLE "UserAddress" DROP COLUMN "country",
DROP COLUMN "state",
ADD COLUMN     "countryId" TEXT,
ADD COLUMN     "stateId" TEXT;

-- AlterTable
ALTER TABLE "UserProfile" DROP COLUMN "countryId",
DROP COLUMN "stateId";

-- CreateTable
CREATE TABLE "AIAssistant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" "EnumAssistantArea" NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIAssistant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAssistantFeature" (
    "id" TEXT NOT NULL,
    "aiAssistantId" TEXT NOT NULL,
    "keyName" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIAssistantFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAIAssistant" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "aiAssistantId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAIAssistant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAIAssistantFeature" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAIAssistantFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvatarList" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvatarList_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AIAssistant_name_key" ON "AIAssistant"("name");

-- CreateIndex
CREATE INDEX "AIAssistantFeature_aiAssistantId_idx" ON "AIAssistantFeature"("aiAssistantId");

-- CreateIndex
CREATE UNIQUE INDEX "AIAssistantFeature_keyName_key" ON "AIAssistantFeature"("keyName");

-- CreateIndex
CREATE INDEX "CompanyAIAssistant_companyId_idx" ON "CompanyAIAssistant"("companyId");

-- CreateIndex
CREATE INDEX "CompanyAIAssistant_aiAssistantId_idx" ON "CompanyAIAssistant"("aiAssistantId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAIAssistant_companyId_aiAssistantId_key" ON "CompanyAIAssistant"("companyId", "aiAssistantId");

-- CreateIndex
CREATE INDEX "CompanyAIAssistantFeature_assignmentId_idx" ON "CompanyAIAssistantFeature"("assignmentId");

-- CreateIndex
CREATE INDEX "CompanyAIAssistantFeature_featureId_idx" ON "CompanyAIAssistantFeature"("featureId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAIAssistantFeature_assignmentId_featureId_key" ON "CompanyAIAssistantFeature"("assignmentId", "featureId");

-- CreateIndex
CREATE UNIQUE INDEX "User_agentPhone_companyId_key" ON "User"("agentPhone", "companyId");

-- AddForeignKey
ALTER TABLE "AIAssistantFeature" ADD CONSTRAINT "AIAssistantFeature_aiAssistantId_fkey" FOREIGN KEY ("aiAssistantId") REFERENCES "AIAssistant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAIAssistant" ADD CONSTRAINT "CompanyAIAssistant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAIAssistant" ADD CONSTRAINT "CompanyAIAssistant_aiAssistantId_fkey" FOREIGN KEY ("aiAssistantId") REFERENCES "AIAssistant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAIAssistantFeature" ADD CONSTRAINT "CompanyAIAssistantFeature_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "CompanyAIAssistant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAIAssistantFeature" ADD CONSTRAINT "CompanyAIAssistantFeature_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "AIAssistantFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAddress" ADD CONSTRAINT "UserAddress_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAddress" ADD CONSTRAINT "UserAddress_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE SET NULL ON UPDATE CASCADE;
