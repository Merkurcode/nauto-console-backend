import { PrismaClient } from '@prisma/client';
import { RolesEnum } from '../src/shared/constants/enums';
import { PERMISSION_EXCLUDE_SYMBOLS, ALLOW_ALL_ROLES } from '../src/shared/constants/permission-exclude';

// Permission configuration with exclude list
// excludeRoles: array of role names that CANNOT have this permission
// Use [PERMISSION_EXCLUDE_SYMBOLS.ALL_ROLES] to exclude all roles except those explicitly granted in role-permissions-map
// Use [PERMISSION_EXCLUDE_SYMBOLS.CUSTOM_ROLES] to exclude all custom roles (where isDefaultAppRole: false)
// Use [PERMISSION_EXCLUDE_SYMBOLS.DEFAULT_ROLES] to exclude all default roles (allowing only custom roles)
// Use [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN] to exclude all EXCEPT root and admin
// Use [PERMISSION_EXCLUDE_SYMBOLS.ALLOW_CUSTOM_AND_LISTED, RolesEnum.ROOT, RolesEnum.ADMIN] to allow ALL custom roles + specified enum roles
// Use ALLOW_ALL_ROLES (null) to allow all roles including custom roles (based on role-permissions-map)
// You can combine specific roles with symbols, e.g.: [RolesEnum.GUEST, PERMISSION_EXCLUDE_SYMBOLS.CUSTOM_ROLES]
export const permissions = [
  {
    name: 'audit:read',
    description: 'Can read audit logs and system monitoring information',
    resource: 'audit',
    action: 'read',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ROOT_READONLY],
  },
  {
    name: 'system:read',
    description: 'Can read system information and monitoring data',
    resource: 'system',
    action: 'read',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ROOT_READONLY],
  },
  {
    name: 'auth:write',
    description: 'Can register users and perform authentication operations',
    resource: 'auth',
    action: 'write',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN, RolesEnum.MANAGER],
  },
  {
    name: 'user:read',
    description: 'Can read user information',
    resource: 'user',
    action: 'read',
    excludeRoles: ALLOW_ALL_ROLES,
  },
  {
    name: 'user:write',
    description: 'Can create and update user information',
    resource: 'user',
    action: 'write',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN, RolesEnum.MANAGER],
  },
  {
    name: 'user:delete',
    description: 'Can delete users',
    resource: 'user',
    action: 'delete',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN, RolesEnum.MANAGER],
  },
  {
    name: 'role:read',
    description: 'Can read role information',
    resource: 'role',
    action: 'read',
    excludeRoles: ALLOW_ALL_ROLES,
  },
  {
    name: 'role:write',
    description: 'Can create and update roles',
    resource: 'role',
    action: 'write',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT],
  },
  {
    name: 'role:delete',
    description: 'Can delete roles',
    resource: 'role',
    action: 'delete',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT],
  },
  {
    name: 'storage:write',
    description: 'Can upload files',
    resource: 'file',
    action: 'write',
    excludeRoles: ALLOW_ALL_ROLES,
  },
  {
    name: 'storage:read',
    description: 'Can read file information',
    resource: 'file',
    action: 'read',
    excludeRoles: ALLOW_ALL_ROLES,
  },
  {
    name: 'storage:delete',
    description: 'Can delete files',
    resource: 'file',
    action: 'delete',
    excludeRoles: ALLOW_ALL_ROLES,
  },
  {
    name: 'storage:manage',
    description: 'Can update file information',
    resource: 'file',
    action: 'manage',
    excludeRoles: ALLOW_ALL_ROLES,
  },
  {
    name: 'company:read',
    description: 'Can read company information',
    resource: 'company',
    action: 'read',
    excludeRoles: ALLOW_ALL_ROLES,
  },
  {
    name: 'company:write',
    description: 'Can create and update companies',
    resource: 'company',
    action: 'write',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN],
  },
  {
    name: 'company:delete',
    description: 'Can delete companies',
    resource: 'company',
    action: 'delete',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT]
  },
  {
    name: 'ai-assistant:read',
    description: 'Can read AI assistant information',
    resource: 'ai-assistant',
    action: 'read',
    excludeRoles: ALLOW_ALL_ROLES,
  },
  {
    name: 'ai-assistant:update',
    description: 'Can update AI assistant assignments and configuration',
    resource: 'ai-assistant',
    action: 'update',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT],
  },
];

export default async function main(prisma: PrismaClient) {
  // Create/update permissions with exclude list
  console.log('Creating/updating permissions...');
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: {
        description: permission.description,
        resource: permission.resource,
        action: permission.action,
        excludeRoles: permission.excludeRoles ? JSON.stringify(permission.excludeRoles) : null,
      },
      create: {
        name: permission.name,
        description: permission.description,
        resource: permission.resource,
        action: permission.action,
        excludeRoles: permission.excludeRoles ? JSON.stringify(permission.excludeRoles) : null,
      },
    });
  }
  console.log(`Updated ${permissions.length} permissions with exclude rules`);
}
