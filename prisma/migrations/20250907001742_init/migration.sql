/*
  Warnings:

  - The values [USER_BULK] on the enum `BulkProcessingType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BulkProcessingType_new" AS ENUM ('PRODUCT_CATALOG');
ALTER TABLE "BulkProcessingRequest" ALTER COLUMN "type" TYPE "BulkProcessingType_new" USING ("type"::text::"BulkProcessingType_new");
ALTER TYPE "BulkProcessingType" RENAME TO "BulkProcessingType_old";
ALTER TYPE "BulkProcessingType_new" RENAME TO "BulkProcessingType";
DROP TYPE "BulkProcessingType_old";
COMMIT;
