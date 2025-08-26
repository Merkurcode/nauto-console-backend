import { PrismaClient } from '@prisma/client';
import * as adminCompanySeeder from './seed-admin-company';
import * as secondCompanySeeder from './seed-second-company';

export default async function main(prisma: PrismaClient) {
  console.log('Seeding dev database...');

  // Create test users/company/roles (Default Company)
  await adminCompanySeeder.default(prisma);

  // Create second test company and users (TechCorp Solutions)
  await secondCompanySeeder.default(prisma);

  console.log('Seeding dev database completed successfully!');
}
