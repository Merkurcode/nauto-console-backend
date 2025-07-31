import { PrismaClient } from '@prisma/client';
import * as countriesSeeder from './seed-countries-states';
import * as rolesSeeder from './seed-roles';
import * as permissionsSeeder from './seed-permissions';
import * as rolePermissionsMapSeeder from './seed-role-permissions-map';
import * as aIAssistantsSeeder from './seed-ai-assistants';
import * as aIAssistantsFeaturesSeeder from './seed-ai-assistants-features';
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
  // Ask if user wants to reset the entire database
  const resetDatabase = await askQuestion('¿Quieres eliminar todos los datos de la base de datos y volver a hacer seed? (s/n): ');
  
  if (resetDatabase === 's' || resetDatabase === 'si' || resetDatabase === 'y' || resetDatabase === 'yes') {
    const confirmReset = await askQuestion('¿Estás seguro? Esta acción eliminará TODOS los datos (s/n): ');
    
    if (confirmReset === 's' || confirmReset === 'si' || confirmReset === 'y' || confirmReset === 'yes') {
      console.log('Eliminando todos los datos de la base de datos...');
      
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
      
      console.log('Todos los datos eliminados.');
    } else {
      console.log('Eliminación cancelada. Continuando con seed normal...');
    }
  }

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
