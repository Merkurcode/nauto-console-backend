import { PrismaClient } from '@prisma/client';
import { permissions } from './seed-permissions';

// Map of role names to permissions they should have
const rolePermissionsMap = {
  root: [
    'user:read', 'user:write', 'user:delete',
    'role:read', 'role:write', 'role:delete',
    'storage:read', 'storage:write', 'storage:delete', 'storage:manage',
    'company:read', 'company:write', 'company:delete',
  ],
  root_readonly: [
    'user:read',
    'role:read',
    'storage:read', 'storage:manage',
    'company:read',
  ],
  admin: [
    'user:read', 'user:write', 'user:delete',
    'role:read', 'role:write', 'role:delete',
    'storage:read', 'storage:write', 'storage:delete', 'storage:manage',
    'company:read', 'company:write', 'company:delete',
  ],
  manager: [
    'user:read',
    'storage:manage', 'storage:write', 'storage:read',
    'company:read'
  ],
  sales_agent: [
    'user:read',
    'storage:manage', 'storage:write', 'storage:read',
    'company:read'
  ],
  guest: [
    'user:read',
    'storage:manage', 'storage:write', 'storage:read',
    'company:read'
  ],
};

export default async function main(prisma: PrismaClient) {
  // Assign permissions to roles
  console.log('Assigning permissions to roles...');
  for (const [roleName, permissionNames] of Object.entries(rolePermissionsMap)) {
    const role = await prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      console.error(`Role ${roleName} not found`);
      continue;
    }

    for (const permissionName of permissionNames) {
      if (!permissions.some(p => p.name === permissionName)) {
        console.error(`Permission ${permissionName} not declared in seed-permissions.ts`);
        continue;
      }

      const permission = await prisma.permission.findUnique({
        where: { name: permissionName },
      });

      if (!permission) {
        console.error(`Permission ${permissionName} not found`);
        continue;
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }
}
