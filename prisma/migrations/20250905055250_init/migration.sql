-- AlterTable
ALTER TABLE "ProductCatalog" ADD COLUMN     "langCode" TEXT,
ADD COLUMN     "link" TEXT,
ADD COLUMN     "sourceFileName" TEXT,
ADD COLUMN     "sourceRowNumber" INTEGER;

-- AlterTable
ALTER TABLE "ProductMedia" ADD COLUMN     "description" TEXT,
ADD COLUMN     "tags" TEXT;
