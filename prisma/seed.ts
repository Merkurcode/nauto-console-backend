import { PrismaClient } from '@prisma/client';
import * as countriesSeeder from './seed-countries-states';
import * as rolesSeeder from './seed-roles';
import * as permissionsSeeder from './seed-permissions';
import * as rolePermissionsMapSeeder from './seed-role-permissions-map';
import * as aIAssistantsSeeder from './seed-ai-assistants';
import * as aIAssistantsFeaturesSeeder from './seed-ai-assistants-features';
import * as aIPersonasSeeder from './seed-ai-personas';
import * as storageTiersSeeder from './seed-storage-tiers';
import * as userStorageConfigsSeeder from './seed-user-storage-configs';
import * as prodRootUserSeeder from './_seed-production-root-user';
import * as readline from 'readline';

import * as devSeeder from './dev-seeds/seed';

const prisma = new PrismaClient();

// Helper function to ask user confirmation
function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  if (process.env.NODE_ENV === 'development')
  {
    // Ask if user wants to reset the entire database
    const resetDatabase = await askQuestion('¿Quieres eliminar todos los registros de la base de datos y volver a hacer seed? (s/n): ');
    
    if (resetDatabase === 's' || resetDatabase === 'si' || resetDatabase === 'y' || resetDatabase === 'yes') {
      const confirmReset = await askQuestion('¿Estás seguro? Esta acción eliminará TODOS los datos (s/n): ');
      
      if (confirmReset === 's' || confirmReset === 'si' || confirmReset === 'y' || confirmReset === 'yes') {
        console.log('Eliminando todos los registros de la base de datos...');
        
        // Get all model names from Prisma client and delete in reverse order
        const modelNames = Object.keys(prisma).filter(key => 
          typeof (prisma as any)[key] === 'object' && 
          (prisma as any)[key].deleteMany
        );
        
        // Delete all data from all models
        for (const modelName of modelNames.reverse()) {
          try {
            await (prisma as any)[modelName].deleteMany({});
            console.log(`${modelName} data deleted.`);
          } catch (error) {
            console.warn(`Could not delete ${modelName}: ${error}`);
          }
        }

        await prisma.role.deleteMany({});
        
        console.log('Todos los datos eliminados.');
      } else {
        console.log('Eliminación cancelada. Continuando con seed normal...');
      }
    }
  }

  console.log('Seeding database...');

  // Create roles
  await rolesSeeder.default(prisma); // ok

  // Create permissions
  await permissionsSeeder.default(prisma); // ok

  // Assign permissions to roles
  await rolePermissionsMapSeeder.default(prisma); // warn

  // Create default countries and states
  await countriesSeeder.default(prisma); // ok

  // Create AI assistants
  await aIAssistantsSeeder.default(prisma); // ok

  // Create AI assistants features
  await aIAssistantsFeaturesSeeder.default(prisma); // ok

  // Create default AI personas
  await aIPersonasSeeder.default(prisma); // ok

  // Create default storage tiers
  await storageTiersSeeder.default(prisma); // ok

  if (process.env.NODE_ENV === 'development')
  {
    await devSeeder.default(prisma);
  }

  // ok
  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'production')
  {
    await prodRootUserSeeder.default(prisma);
  }

  // Create default user storage configurations
  await userStorageConfigsSeeder.default(prisma); // ok

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
