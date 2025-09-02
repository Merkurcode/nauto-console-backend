-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('NOT_PROVIDED', 'PENDING_TO_SEND', 'SENT', 'SEND_ERROR');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailStatus" "NotificationStatus" NOT NULL DEFAULT 'NOT_PROVIDED',
ADD COLUMN     "lastEmailError" TEXT,
ADD COLUMN     "lastSmsError" TEXT,
ADD COLUMN     "smsStatus" "NotificationStatus" NOT NULL DEFAULT 'NOT_PROVIDED';
