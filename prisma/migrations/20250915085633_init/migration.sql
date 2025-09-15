-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'FAILED', 'DONE');

-- CreateEnum
CREATE TYPE "ReminderQueueStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'STANDBY');

-- CreateEnum
CREATE TYPE "ReminderNotificationOptOutType" AS ENUM ('REMINDERS', 'MARKETING');

-- CreateEnum
CREATE TYPE "NotificationMedium" AS ENUM ('WHATSAPP');

-- CreateEnum
CREATE TYPE "ReminderFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- AlterEnum
ALTER TYPE "BulkProcessingType" ADD VALUE 'CLIENT_REMINDER';

-- CreateTable
CREATE TABLE "ReminderNotificationOptOut" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "optOutType" "ReminderNotificationOptOutType" NOT NULL,
    "optOutMedium" "NotificationMedium" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderNotificationOptOut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientReminderQueue" (
    "id" TEXT NOT NULL,
    "queueNumber" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "template" JSONB NOT NULL,
    "targetMedium" "NotificationMedium" NOT NULL,
    "callActions" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReminderQueueStatus" NOT NULL DEFAULT 'STANDBY',
    "lastReminderProcessedId" TEXT,
    "lastTimeChecked" TIMESTAMP(3),
    "companyId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceFileName" TEXT,
    "bulkRequestId" TEXT,
    "metadata" JSONB,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "interval" INTEGER NOT NULL,
    "days" TEXT[],
    "startHour" TEXT NOT NULL,
    "endHour" TEXT NOT NULL,
    "maxCount" INTEGER,
    "timezone" TEXT NOT NULL,
    "frequency" "ReminderFrequency" NOT NULL,
    "stopUntil" TIMESTAMP(3),

    CONSTRAINT "ClientReminderQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientReminder" (
    "id" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "targetMedium" "NotificationMedium" NOT NULL,
    "sentLastTime" TIMESTAMP(3),
    "sentLastDay" TIMESTAMP(3),
    "receivedByBot" BOOLEAN NOT NULL DEFAULT false,
    "stopReminders" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "lastFailTimes" BIGINT NOT NULL DEFAULT 0,
    "lastFailTime" TIMESTAMP(3),
    "lastHttpCode" INTEGER,
    "lastHttpResponse" TEXT,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "sourceFileName" TEXT,
    "sourceRowNumber" INTEGER,
    "bulkRequestId" TEXT,
    "metadata" JSONB,
    "clientReminderQueueId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledClientReminderQueues" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientReminderQueueId" TEXT NOT NULL,
    "day" TEXT NOT NULL,

    CONSTRAINT "ScheduledClientReminderQueues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReminderNotificationOptOut_phone_idx" ON "ReminderNotificationOptOut"("phone");

-- CreateIndex
CREATE INDEX "ReminderNotificationOptOut_optOutType_idx" ON "ReminderNotificationOptOut"("optOutType");

-- CreateIndex
CREATE INDEX "ReminderNotificationOptOut_optOutMedium_idx" ON "ReminderNotificationOptOut"("optOutMedium");

-- CreateIndex
CREATE INDEX "ReminderNotificationOptOut_createdAt_idx" ON "ReminderNotificationOptOut"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderNotificationOptOut_phone_optOutType_optOutMedium_key" ON "ReminderNotificationOptOut"("phone", "optOutType", "optOutMedium");

-- CreateIndex
CREATE INDEX "ClientReminderQueue_companyId_idx" ON "ClientReminderQueue"("companyId");

-- CreateIndex
CREATE INDEX "ClientReminderQueue_companyId_status_idx" ON "ClientReminderQueue"("companyId", "status");

-- CreateIndex
CREATE INDEX "ClientReminderQueue_companyId_active_idx" ON "ClientReminderQueue"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ClientReminderQueue_companyId_queueNumber_key" ON "ClientReminderQueue"("companyId", "queueNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ClientReminderQueue_companyId_name_key" ON "ClientReminderQueue"("companyId", "name");

-- CreateIndex
CREATE INDEX "ClientReminder_companyId_idx" ON "ClientReminder"("companyId");

-- CreateIndex
CREATE INDEX "ClientReminder_clientReminderQueueId_idx" ON "ClientReminder"("clientReminderQueueId");

-- CreateIndex
CREATE INDEX "ClientReminder_clientReminderQueueId_status_idx" ON "ClientReminder"("clientReminderQueueId", "status");

-- CreateIndex
CREATE INDEX "ClientReminder_clientReminderQueueId_receivedByBot_idx" ON "ClientReminder"("clientReminderQueueId", "receivedByBot");

-- CreateIndex
CREATE INDEX "ClientReminder_companyId_status_idx" ON "ClientReminder"("companyId", "status");

-- CreateIndex
CREATE INDEX "ClientReminder_companyId_stopReminders_idx" ON "ClientReminder"("companyId", "stopReminders");

-- CreateIndex
CREATE INDEX "ClientReminder_clientPhone_idx" ON "ClientReminder"("clientPhone");

-- CreateIndex
CREATE INDEX "ClientReminder_bulkRequestId_idx" ON "ClientReminder"("bulkRequestId");

-- CreateIndex
CREATE INDEX "ClientReminder_clientPhone_targetMedium_idx" ON "ClientReminder"("clientPhone", "targetMedium");

-- CreateIndex
CREATE UNIQUE INDEX "ClientReminder_clientPhone_companyId_clientReminderQueueId_key" ON "ClientReminder"("clientPhone", "companyId", "clientReminderQueueId");

-- CreateIndex
CREATE INDEX "ScheduledClientReminderQueues_clientReminderQueueId_idx" ON "ScheduledClientReminderQueues"("clientReminderQueueId");

-- CreateIndex
CREATE INDEX "ScheduledClientReminderQueues_day_idx" ON "ScheduledClientReminderQueues"("day");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledClientReminderQueues_clientReminderQueueId_day_key" ON "ScheduledClientReminderQueues"("clientReminderQueueId", "day");

-- AddForeignKey
ALTER TABLE "ClientReminderQueue" ADD CONSTRAINT "ClientReminderQueue_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReminderQueue" ADD CONSTRAINT "ClientReminderQueue_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReminderQueue" ADD CONSTRAINT "ClientReminderQueue_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReminderQueue" ADD CONSTRAINT "ClientReminderQueue_lastReminderProcessedId_fkey" FOREIGN KEY ("lastReminderProcessedId") REFERENCES "ClientReminder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReminder" ADD CONSTRAINT "ClientReminder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReminder" ADD CONSTRAINT "ClientReminder_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReminder" ADD CONSTRAINT "ClientReminder_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReminder" ADD CONSTRAINT "ClientReminder_clientReminderQueueId_fkey" FOREIGN KEY ("clientReminderQueueId") REFERENCES "ClientReminderQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReminder" ADD CONSTRAINT "ClientReminder_bulkRequestId_fkey" FOREIGN KEY ("bulkRequestId") REFERENCES "BulkProcessingRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledClientReminderQueues" ADD CONSTRAINT "ScheduledClientReminderQueues_clientReminderQueueId_fkey" FOREIGN KEY ("clientReminderQueueId") REFERENCES "ClientReminderQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
