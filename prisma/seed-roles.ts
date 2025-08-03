import { PrismaClient } from '@prisma/client';
import { RolesEnum } from '../src/shared/constants/enums';

// Roles with hierarchy levels: 1=root, 2=admin, 3=manager, 4=sales_agent/host, 5=guest
const roles = [
  {
    name: RolesEnum.ROOT,
    description: 'Super administrator role with full access',
    hierarchyLevel: 1,
    isDefault: false,
    isDefaultAppRole: true,
  },
  {
    name: RolesEnum.ROOT_READONLY,
    description: 'Super administrator role with full access (read only)',
    hierarchyLevel: 1,
    isDefault: false,
    isDefaultAppRole: true,
  },
  {
    name: RolesEnum.ADMIN,
    description: 'Administrator role with limited access',
    hierarchyLevel: 2,
    isDefault: false,
    isDefaultAppRole: true,
  },
  {
    name: RolesEnum.MANAGER,
    description: 'Manager role with limited access',
    hierarchyLevel: 3,
    isDefault: false,
    isDefaultAppRole: true,
  },
  {
    name: RolesEnum.SALES_AGENT,
    description: 'Sales agent role with limited access',
    hierarchyLevel: 4,
    isDefault: false,
    isDefaultAppRole: true,
  },
  {
    name: RolesEnum.HOST,
    description: 'Host role with limited access',
    hierarchyLevel: 4,
    isDefault: false,
    isDefaultAppRole: true,
  },
  {
    name: RolesEnum.GUEST,
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
