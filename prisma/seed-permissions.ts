import { PrismaClient } from '@prisma/client';
import { RolesEnum } from '../src/shared/constants/enums';
import { PERMISSION_EXCLUDE_SYMBOLS, ALLOW_ALL_ROLES } from '../src/shared/constants/permission-exclude';
import { ActiveResources, getResourceKey } from '@shared/constants/bulk-processing-type.enum';

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
    name: 'root:access',
    description: 'Can access root-level features and functionality',
    resource: 'root',
    action: 'access',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ROOT_READONLY],
  },
  {
    name: 'sensitive:operations',
    description: 'Can perform sensitive operations that require 2FA',
    resource: 'sensitive',
    action: 'operations',
    excludeRoles: ALLOW_ALL_ROLES,
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
  {
    name: 'company-user:assign',
    description: 'Can assign users to companies',
    resource: 'company-user',
    action: 'assign',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN],
  },
  {
    name: 'company-user:remove',
    description: 'Can remove users from companies',
    resource: 'company-user',
    action: 'remove',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN],
  },
  {
    name: 'company_schedules:read',
    description: 'Can read company schedules',
    resource: 'company_schedules',
    action: 'read',
    excludeRoles: ALLOW_ALL_ROLES,
  },
  {
    name: 'company_schedules:write',
    description: 'Can create and update company schedules',
    resource: 'company_schedules',
    action: 'write',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN, RolesEnum.MANAGER],
  },
  {
    name: 'company_schedules:delete',
    description: 'Can delete company schedules',
    resource: 'company_schedules',
    action: 'delete',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN, RolesEnum.MANAGER],
  },
  {
    name: 'company_events:read',
    description: 'Can read company events catalog',
    resource: 'company_events',
    action: 'read',
    excludeRoles: ALLOW_ALL_ROLES,
  },
  {
    name: 'company_events:write',
    description: 'Can create and update company events catalog',
    resource: 'company_events',
    action: 'write',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN, RolesEnum.MANAGER],
  },
  {
    name: 'company_events:delete',
    description: 'Can delete company events catalog',
    resource: 'company_events',
    action: 'delete',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN, RolesEnum.MANAGER],
  },
  {
    name: 'bot:read',
    description: 'Can read BOT tokens and information',
    resource: 'bot',
    action: 'read',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT],
  },
  {
    name: 'bot:write',
    description: 'Can create and generate BOT tokens',
    resource: 'bot',
    action: 'write',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT],
  },
  {
    name: 'bot:delete',
    description: 'Can delete and revoke BOT tokens',
    resource: 'bot',
    action: 'delete',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT],
  },
  {
    name: 'user_activity_log:read',
    description: 'Can read user activity logs',
    resource: 'user_activity_log',
    action: 'read',
    excludeRoles: ALLOW_ALL_ROLES,
  },
  {
    name: 'ai-persona:read',
    description: 'Can read AI persona information and configurations',
    resource: 'ai-persona',
    action: 'read',
    excludeRoles: ALLOW_ALL_ROLES,
  },
  {
    name: 'ai-persona:write',
    description: 'Can create and update AI personas',
    resource: 'ai-persona',
    action: 'write',
    excludeRoles: ALLOW_ALL_ROLES,
  },
  {
    name: 'ai-persona:delete',
    description: 'Can delete AI personas',
    resource: 'ai-persona',
    action: 'delete',
    excludeRoles: ALLOW_ALL_ROLES,
  },
  {
    name: 'ai-persona:update',
    description: 'Can update AI persona configurations and properties',
    resource: 'ai-persona',
    action: 'update',
    excludeRoles: ALLOW_ALL_ROLES,
  },
  {
    name: 'ai-persona:assign',
    description: 'Can assign AI personas to companies',
    resource: 'ai-persona',
    action: 'assign',
    excludeRoles: ALLOW_ALL_ROLES,
  },
  {
    name: 'company-ai-config:read',
    description: 'Can read company AI configuration settings',
    resource: 'company-ai-config',
    action: 'read',
    excludeRoles: ALLOW_ALL_ROLES,
  },
  {
    name: 'company-ai-config:write',
    description: 'Can create and update company AI configuration settings',
    resource: 'company-ai-config',
    action: 'write',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN, RolesEnum.MANAGER],
  },
  {
    name: 'company-ai-config:delete',
    description: 'Can delete company AI configuration settings',
    resource: 'company-ai-config',
    action: 'delete',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN, RolesEnum.MANAGER],
  },
  // Marketing Campaign permissions
  {
    name: 'marketing-campaign:read',
    description: 'Can read marketing campaign information and configurations',
    resource: 'marketing-campaign',
    action: 'read',
    excludeRoles: ALLOW_ALL_ROLES,
  },
  {
    name: 'marketing-campaign:write',
    description: 'Can create new marketing campaigns',
    resource: 'marketing-campaign',
    action: 'write',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN, RolesEnum.MANAGER],
  },
  {
    name: 'marketing-campaign:update',
    description: 'Can update existing marketing campaigns',
    resource: 'marketing-campaign',
    action: 'update',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN, RolesEnum.MANAGER],
  },
  {
    name: 'marketing-campaign:delete',
    description: 'Can delete marketing campaigns',
    resource: 'marketing-campaign',
    action: 'delete',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN],
  },
  {
    name: 'marketing-campaign:manage',
    description: 'Can enable/disable marketing campaigns',
    resource: 'marketing-campaign',
    action: 'manage',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN, RolesEnum.MANAGER],
  },
  // Product Catalog permissions
  {
    name: 'product-catalog:read',
    description: 'Can read product catalog information',
    resource: 'product-catalog',
    action: 'read',
    excludeRoles: ALLOW_ALL_ROLES,
  },
  {
    name: 'product-catalog:write',
    description: 'Can create and update product catalogs',
    resource: 'product-catalog',
    action: 'write',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN, RolesEnum.MANAGER],
  },
  {
    name: 'product-catalog:delete',
    description: 'Can delete product catalogs',
    resource: 'product-catalog',
    action: 'delete',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN, RolesEnum.MANAGER],
  },
  // Product Media permissions
  {
    name: 'product-media:read',
    description: 'Can read product media information',
    resource: 'product-media',
    action: 'read',
    excludeRoles: ALLOW_ALL_ROLES,
  },
  {
    name: 'product-media:write',
    description: 'Can create and update product media',
    resource: 'product-media',
    action: 'write',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN, RolesEnum.MANAGER],
  },
  {
    name: 'product-media:delete',
    description: 'Can delete product media',
    resource: 'product-media',
    action: 'delete',
    excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN, RolesEnum.MANAGER],
  },
  {
    name: getResourceKey(ActiveResources.PRODUCTS, 'write'),
    description: 'Can create and initiate bulk requests',
    resource: getResourceKey(ActiveResources.PRODUCTS, 'write').split(':')[0],
    action: 'write',
    excludeRoles: ALLOW_ALL_ROLES,
  },
  {
    name: getResourceKey(ActiveResources.PRODUCTS, 'delete'),
    description: 'Can delete bulk requests',
    resource: getResourceKey(ActiveResources.PRODUCTS, 'delete').split(':')[0],
    action: 'delete',
    excludeRoles: ALLOW_ALL_ROLES,
  },
  {
    name: getResourceKey(ActiveResources.PRODUCTS, 'manage-events'),
    description: 'Can manage bulk request events',
    resource: getResourceKey(ActiveResources.PRODUCTS, 'manage-events').split(':')[0],
    action: 'manage-events',
    excludeRoles: ALLOW_ALL_ROLES,
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
