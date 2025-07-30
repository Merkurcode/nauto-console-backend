import { PrismaClient } from '@prisma/client';
import * as countriesSeeder from './seed-countries-states';
import * as rolesSeeder from './seed-roles';
import * as permissionsSeeder from './seed-permissions';
import * as rolePermissionsMapSeeder from './seed-role-permissions-map';
import * as aIAssistantsSeeder from './seed-ai-assistants';
import * as aIAssistantsFeaturesSeeder from './seed-ai-assistants-features';

import * as devSeeder from './dev-seeds/seed';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create roles
  await rolesSeeder.default(prisma);

  // Create permissions
  await permissionsSeeder.default(prisma);

  // Assign permissions to roles
  await rolePermissionsMapSeeder.default(prisma);

  // Create default countries and states
  await countriesSeeder.default(prisma);

  // Create AI assistants
  await aIAssistantsSeeder.default(prisma);

  // Create AI assistants features
  await aIAssistantsFeaturesSeeder.default(prisma);

  if (process.env.NODE_ENV === 'development') 
  {
    await devSeeder.default(prisma);
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
