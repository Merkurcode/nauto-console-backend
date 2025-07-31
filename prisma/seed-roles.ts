import { PrismaClient } from '@prisma/client';

// Roles
const roles = [
  {
    name: 'root',
    description: 'Super administrator role with full access',
    isDefault: false,
    isDefaultAppRole: true,
  },
  {
    name: 'root_readonly',
    description: 'Super administrator role with full access (read only)',
    isDefault: false,
    isDefaultAppRole: true,
  },
  {
    name: 'admin',
    description: 'Administrator role with limited access',
    isDefault: false,
    isDefaultAppRole: true,
  },
  {
    name: 'manager',
    description: 'Manager role with limited access',
    isDefault: false,
    isDefaultAppRole: true,
  },
  {
    name: 'sales_agent',
    description: 'Sales agent role with limited access',
    isDefault: false,
    isDefaultAppRole: true,
  },
  {
    name: 'host',
    description: 'Host role with limited access',
    isDefault: false,
    isDefaultAppRole: true,
  },
  {
    name: 'guest',
    description: 'Default user role with limited access',
    isDefault: true,
    isDefaultAppRole: true,
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
