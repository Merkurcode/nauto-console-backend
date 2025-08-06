-- AlterTable
ALTER TABLE "User" ADD COLUMN     "agentPhoneCountryCode" TEXT DEFAULT '52';

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "phoneCountryCode" TEXT DEFAULT '52';
