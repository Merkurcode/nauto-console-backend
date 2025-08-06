-- CreateTable
CREATE TABLE "CompanyEventsCatalog" (
    "title" JSONB NOT NULL,
    "description" JSONB NOT NULL,
    "iconUrl" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "isPhysical" BOOLEAN NOT NULL DEFAULT false,
    "isAppointment" BOOLEAN NOT NULL DEFAULT false,
    "eventName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "CompanySchedules" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "CompanySchedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyEventsCatalog_companyId_eventName_key" ON "CompanyEventsCatalog"("companyId", "eventName");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySchedules_companyId_dayOfWeek_key" ON "CompanySchedules"("companyId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "CompanyEventsCatalog" ADD CONSTRAINT "CompanyEventsCatalog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySchedules" ADD CONSTRAINT "CompanySchedules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
