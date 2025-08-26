/*
  Warnings:

  - The values [FAILED,CANCELED,DELETED] on the enum `FileStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "FileStatus_new" AS ENUM ('PENDING', 'UPLOADING', 'UPLOADED', 'COPYING');
ALTER TABLE "File" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "File" ALTER COLUMN "status" TYPE "FileStatus_new" USING ("status"::text::"FileStatus_new");
ALTER TYPE "FileStatus" RENAME TO "FileStatus_old";
ALTER TYPE "FileStatus_new" RENAME TO "FileStatus";
DROP TYPE "FileStatus_old";
ALTER TABLE "File" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;
