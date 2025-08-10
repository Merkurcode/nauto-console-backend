-- CreateTable
CREATE TABLE "StorageTiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "maxStorageBytes" BIGINT NOT NULL,
    "maxSimultaneousFiles" INTEGER NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageTiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStorageConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storageTierId" TEXT NOT NULL,
    "allowedFileConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStorageConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StorageTiers_name_key" ON "StorageTiers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StorageTiers_level_key" ON "StorageTiers"("level");

-- CreateIndex
CREATE INDEX "StorageTiers_level_idx" ON "StorageTiers"("level");

-- CreateIndex
CREATE INDEX "StorageTiers_isActive_idx" ON "StorageTiers"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "UserStorageConfig_userId_key" ON "UserStorageConfig"("userId");

-- CreateIndex
CREATE INDEX "UserStorageConfig_userId_idx" ON "UserStorageConfig"("userId");

-- CreateIndex
CREATE INDEX "UserStorageConfig_storageTierId_idx" ON "UserStorageConfig"("storageTierId");

-- AddForeignKey
ALTER TABLE "UserStorageConfig" ADD CONSTRAINT "UserStorageConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStorageConfig" ADD CONSTRAINT "UserStorageConfig_storageTierId_fkey" FOREIGN KEY ("storageTierId") REFERENCES "StorageTiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
