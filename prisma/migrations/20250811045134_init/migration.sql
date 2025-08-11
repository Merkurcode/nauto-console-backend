-- CreateEnum
CREATE TYPE "UserActivityType" AS ENUM ('AUTHENTICATION', 'PROFILE_MANAGEMENT', 'ROLE_MANAGEMENT', 'SECURITY_SETTINGS', 'COMPANY_ASSIGNMENT', 'ACCOUNT_MANAGEMENT');

-- CreateEnum
CREATE TYPE "UserActivityImpact" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "UserActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityType" "UserActivityType" NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impact" "UserActivityImpact" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserActivityLog_userId_timestamp_idx" ON "UserActivityLog"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "UserActivityLog_activityType_timestamp_idx" ON "UserActivityLog"("activityType", "timestamp");

-- CreateIndex
CREATE INDEX "UserActivityLog_impact_timestamp_idx" ON "UserActivityLog"("impact", "timestamp");

-- CreateIndex
CREATE INDEX "UserActivityLog_timestamp_idx" ON "UserActivityLog"("timestamp");

-- AddForeignKey
ALTER TABLE "UserActivityLog" ADD CONSTRAINT "UserActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
