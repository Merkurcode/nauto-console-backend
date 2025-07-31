import { PrismaClient } from '@prisma/client';

// Permissions
export const permissions = [
  {
    name: 'audit:read',
    description: 'Can read audit logs and system monitoring information',
    resource: 'audit',
    action: 'read',
  },
  {
    name: 'system:read',
    description: 'Can read system information and monitoring data',
    resource: 'system',
    action: 'read',
  },
  {
    name: 'auth:write',
    description: 'Can register users and perform authentication operations',
    resource: 'auth',
    action: 'write',
  },
  {
    name: 'user:read',
    description: 'Can read user information',
    resource: 'user',
    action: 'read',
  },
  {
    name: 'user:write',
    description: 'Can create and update user information',
    resource: 'user',
    action: 'write',
  },
  {
    name: 'user:delete',
    description: 'Can delete users',
    resource: 'user',
    action: 'delete',
  },
  {
    name: 'role:read',
    description: 'Can read role information',
    resource: 'role',
    action: 'read',
  },
  {
    name: 'role:write',
    description: 'Can create and update roles',
    resource: 'role',
    action: 'write',
  },
  {
    name: 'role:delete',
    description: 'Can delete roles',
    resource: 'role',
    action: 'delete',
  },
  {
    name: 'storage:write',
    description: 'Can upload files',
    resource: 'file',
    action: 'write',
  },
  {
    name: 'storage:read',
    description: 'Can read file information',
    resource: 'file',
    action: 'read',
  },
  {
    name: 'storage:delete',
    description: 'Can delete files',
    resource: 'file',
    action: 'delete',
  },
  {
    name: 'storage:manage',
    description: 'Can update file information',
    resource: 'file',
    action: 'manage',
  },
  {
    name: 'company:read',
    description: 'Can read company information',
    resource: 'company',
    action: 'read',
  },
  {
    name: 'company:write',
    description: 'Can create and update companies',
    resource: 'company',
    action: 'write',
  },
  {
    name: 'company:delete',
    description: 'Can delete companies',
    resource: 'company',
    action: 'delete',
  },
];

export default async function main(prisma: PrismaClient) {
  // Create permissions
  console.log('Creating permissions...');
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: {},
      create: permission,
    });
  }
}
