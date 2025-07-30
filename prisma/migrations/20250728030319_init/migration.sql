/*
  Warnings:

  - Added the required column `title` to the `AIAssistantFeature` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AIAssistantFeature" ADD COLUMN     "title" JSONB NOT NULL;
