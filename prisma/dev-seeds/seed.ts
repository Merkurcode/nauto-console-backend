import { PrismaClient } from '@prisma/client';
import * as adminCompanySeeder from './seed-admin-company';

export default async function main(prisma: PrismaClient) {
  console.log('Seeding dev database...');

  // Create test users/company/roles
  await adminCompanySeeder.default(prisma);

  console.log('Seeding dev database completed successfully!');
}
