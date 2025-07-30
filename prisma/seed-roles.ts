import { PrismaClient } from '@prisma/client';

// Roles
const roles = [
  {
    name: 'root',
    description: 'Super administrator role with full access',
    isDefault: false,
  },
  {
    name: 'root_readonly',
    description: 'Super administrator role with full access (read only)',
    isDefault: false,
  },
  {
    name: 'admin',
    description: 'Administrator role with limited access',
    isDefault: false,
  },
  {
    name: 'manager',
    description: 'Manager role with limited access',
    isDefault: false,
  },
  {
    name: 'sales_agent',
    description: 'Sales agent role with limited access',
    isDefault: false,
  },
  {
    name: 'guest',
    description: 'Default user role with limited access',
    isDefault: true,
  },
];

export default async function main(prisma: PrismaClient) {
  // Create roles
  console.log('Creating roles...');
  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }
}
