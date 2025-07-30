/*
  Warnings:

  - Changed the type of `description` on the `AIAssistant` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `description` to the `AIAssistantFeature` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AIAssistant" DROP COLUMN "description",
ADD COLUMN     "description" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "AIAssistantFeature" DROP COLUMN "description",
ADD COLUMN     "description" JSONB NOT NULL;
