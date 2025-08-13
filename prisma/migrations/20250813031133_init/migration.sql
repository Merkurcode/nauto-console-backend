/*
  Warnings:

  - Added the required column `shortDetails` to the `AIPersona` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `tone` on the `AIPersona` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `personality` on the `AIPersona` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `objective` on the `AIPersona` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "AIPersona" ADD COLUMN     "shortDetails" JSONB NOT NULL,
DROP COLUMN "tone",
ADD COLUMN     "tone" JSONB NOT NULL,
DROP COLUMN "personality",
ADD COLUMN     "personality" JSONB NOT NULL,
DROP COLUMN "objective",
ADD COLUMN     "objective" JSONB NOT NULL;
