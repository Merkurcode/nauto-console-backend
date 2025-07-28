-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "language" TEXT DEFAULT 'es-MX',
ADD COLUMN     "privacyPolicyUrl" TEXT,
ADD COLUMN     "websiteUrl" TEXT,
ALTER COLUMN "timezone" SET DEFAULT 'America/Mexico_City';
