import { PrismaClient } from '@prisma/client';

// Roles with hierarchy levels: 1=root, 2=admin, 3=manager, 4=sales_agent/host, 5=guest
const roles = [
  {
    name: 'root',
    description: 'Super administrator role with full access',
    hierarchyLevel: 1,
    isDefault: false,
    isDefaultAppRole: true,
  },
  {
    name: 'root_readonly',
    description: 'Super administrator role with full access (read only)',
    hierarchyLevel: 1,
    isDefault: false,
    isDefaultAppRole: true,
  },
  {
    name: 'admin',
    description: 'Administrator role with limited access',
    hierarchyLevel: 2,
    isDefault: false,
    isDefaultAppRole: true,
  },
  {
    name: 'manager',
    description: 'Manager role with limited access',
    hierarchyLevel: 3,
    isDefault: false,
    isDefaultAppRole: true,
  },
  {
    name: 'sales_agent',
    description: 'Sales agent role with limited access',
    hierarchyLevel: 4,
    isDefault: false,
    isDefaultAppRole: true,
  },
  {
    name: 'host',
    description: 'Host role with limited access',
    hierarchyLevel: 4,
    isDefault: false,
    isDefaultAppRole: true,
  },
  {
    name: 'guest',
    description: 'Default user role with limited access',
    hierarchyLevel: 5,
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
      update: {
        description: role.description,
        hierarchyLevel: role.hierarchyLevel,
        isDefault: role.isDefault,
        isDefaultAppRole: role.isDefaultAppRole,
      },
      create: role,
    });
  }
}
