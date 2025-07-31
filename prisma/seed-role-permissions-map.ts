import { PrismaClient } from '@prisma/client';
import { permissions } from './seed-permissions';

// Map of role names to permissions they should have
const rolePermissionsMap = {
  root: [
    'system:read',
    'audit:read',
    'auth:write',
    'user:read', 'user:write', 'user:delete',
    'role:read', 'role:write', 'role:delete',
    'storage:read', 'storage:write', 'storage:delete', 'storage:manage',
    'company:read', 'company:write', 'company:delete',
  ],
  root_readonly: [
    'system:read',
    'user:read',
    'role:read',
    'storage:read', 'storage:manage',
    'company:read',
  ],
  admin: [
    'auth:write',
    'user:read', 'user:write', 'user:delete',
    'role:read', 'role:write', 'role:delete',
    'storage:read', 'storage:write', 'storage:delete', 'storage:manage',
    'company:read', 'company:write',
  ],
  manager: [
    'auth:write',
    'user:read',
    'storage:manage', 'storage:write', 'storage:read',
    'company:read'
  ],
  sales_agent: [
    'user:read',
    'storage:manage', 'storage:write', 'storage:read',
    'company:read'
  ],
  host: [
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

    // Delete all existing permissions for this role first
    console.log(`Clearing existing permissions for role: ${roleName}`);
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id },
    });

    // Add new permissions for this role
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

      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }

    console.log(`Assigned ${permissionNames.length} permissions to role: ${roleName}`);
  }
}
