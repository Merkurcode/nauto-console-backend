-- CreateEnum
CREATE TYPE "EnumIndustrySector" AS ENUM ('AUTOMOTIVE', 'CUSTOMER_SERVICE', 'EDUCATION', 'HEALTHCARE', 'REAL_ESTATE', 'OTHER');

-- CreateEnum
CREATE TYPE "EnumIndustryOperationChannel" AS ENUM ('ONLINE', 'PHYSICAL', 'MIXED');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "industryOperationChannel" "EnumIndustryOperationChannel" NOT NULL DEFAULT 'MIXED',
ADD COLUMN     "industrySector" "EnumIndustrySector" NOT NULL DEFAULT 'OTHER';
