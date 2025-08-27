import { PrismaClient } from '@prisma/client';

const storageTiers = [
  {
    name: 'Basic',
    level: '1',
    maxStorageBytes: BigInt(10 * 1024 * 1024 * 1024), // 10GB
    maxSimultaneousFiles: 5,
    isActive: true,
  },
];

export default async function main(prisma: PrismaClient) {
  console.log('Creating default storage tiers...');

  for (const tierData of storageTiers) {
    try {
      // Check if tier already exists
      const existingTier = await prisma.storageTiers.findUnique({
        where: { level: tierData.level },
      });

      if (existingTier) {
        //console.log(`⚠ Storage tier ${tierData.name} (level ${tierData.level}) already exists`);
        continue;
      }

      const tier = await prisma.storageTiers.create({
        data: tierData,
      });

      console.log(`✓ Created storage tier: ${tier.name} (level ${tier.level}) - ${Number(tier.maxStorageBytes) / (1024 * 1024 * 1024)}GB`);
    } catch (error) {
      console.error(`✗ Failed to create storage tier ${tierData.name}:`, error);
    }
  }

  console.log('Storage tiers seeding completed ✓');
}
