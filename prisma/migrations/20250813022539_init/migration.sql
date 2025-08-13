-- CreateTable
CREATE TABLE "AIPersona" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyName" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "personality" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "companyId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "AIPersona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAIPersona" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "aiPersonaId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,

    CONSTRAINT "CompanyAIPersona_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIPersona_isDefault_idx" ON "AIPersona"("isDefault");

-- CreateIndex
CREATE INDEX "AIPersona_companyId_idx" ON "AIPersona"("companyId");

-- CreateIndex
CREATE INDEX "AIPersona_isActive_idx" ON "AIPersona"("isActive");

-- CreateIndex
CREATE INDEX "AIPersona_createdAt_idx" ON "AIPersona"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AIPersona_keyName_companyId_key" ON "AIPersona"("keyName", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAIPersona_companyId_key" ON "CompanyAIPersona"("companyId");

-- CreateIndex
CREATE INDEX "CompanyAIPersona_aiPersonaId_idx" ON "CompanyAIPersona"("aiPersonaId");

-- CreateIndex
CREATE INDEX "CompanyAIPersona_isActive_idx" ON "CompanyAIPersona"("isActive");

-- AddForeignKey
ALTER TABLE "AIPersona" ADD CONSTRAINT "AIPersona_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIPersona" ADD CONSTRAINT "AIPersona_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIPersona" ADD CONSTRAINT "AIPersona_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAIPersona" ADD CONSTRAINT "CompanyAIPersona_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAIPersona" ADD CONSTRAINT "CompanyAIPersona_aiPersonaId_fkey" FOREIGN KEY ("aiPersonaId") REFERENCES "AIPersona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAIPersona" ADD CONSTRAINT "CompanyAIPersona_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
