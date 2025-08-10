import { PrismaClient } from '@prisma/client';

export default async function main(prisma: PrismaClient) {
  console.log('Creating default user storage configurations...');

  // Get default values from environment variables
  const defaultStorageTierLevel = process.env.DEFAULT_STORAGE_TIER_LEVEL;
  
  // Parse allowed file config from environment (JSON string)
  const defaultAllowedFileConfig = JSON.parse(process.env.DEFAULT_ALLOWED_FILE_CONFIG);

  // Find the default storage tier
  const defaultStorageTier = await prisma.storageTiers.findUnique({
    where: { level: defaultStorageTierLevel },
  });

  if (!defaultStorageTier) {
    console.error(`❌ Default storage tier with level ${defaultStorageTierLevel} not found. Please run storage tiers seed first.`);
    return;
  }

  console.log(`Using default storage tier: ${defaultStorageTier.name} (level ${defaultStorageTier.level}) - ${Number(defaultStorageTier.maxStorageBytes) / (1024 * 1024)}MB`);
  console.log(`Allowed extensions: ${Object.keys(defaultAllowedFileConfig).join(', ')}`);

  // Get all existing users that don't have storage config yet
  const usersWithoutStorageConfig = await prisma.user.findMany({
    where: {
      storageConfig: null,
    },
    select: {
      id: true,
      email: true,
    },
  });

  console.log(`Found ${usersWithoutStorageConfig.length} users without storage configuration.`);

  // Create storage config for each user
  for (const user of usersWithoutStorageConfig) {
    try {
      await prisma.userStorageConfig.create({
        data: {
          userId: user.id,
          storageTierId: defaultStorageTier.id,
          allowedFileConfig: defaultAllowedFileConfig,
        },
      });
      
      console.log(`✓ Created storage config for user: ${user.email}`);
    } catch (error) {
      // Skip if already exists (race condition)
      if ((error as any).code === 'P2002') {
        console.log(`⚠ Storage config already exists for user: ${user.email}`);
      } else {
        console.error(`✗ Failed to create storage config for user ${user.email}:`, error);
      }
    }
  }

  console.log('User storage configurations seeding completed');
}
