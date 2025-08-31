import { PrismaClient } from '@prisma/client';
import { permissions } from './seed-permissions';
import { RolesEnum } from '../src/shared/constants/enums';
import { PERMISSION_EXCLUDE_SYMBOLS } from '../src/shared/constants/permission-exclude';

// Map of role names to permissions they should have
const rolePermissionsMap = {
  [RolesEnum.ROOT]: [
    'sensitive:operations',
    'root:access',
    'system:read',
    'audit:read',
    'auth:write',
    'user:read', 'user:write', 'user:delete',
    'role:read', 'role:write', 'role:delete',
    'storage:read', 'storage:write', 'storage:delete', 'storage:manage',
    'company:read', 'company:write', 'company:delete',
    'ai-assistant:read', 'ai-assistant:update',
    'company-user:assign', 'company-user:remove',
    'company_schedules:read', 'company_schedules:write', 'company_schedules:delete',
    'company_events:read', 'company_events:write', 'company_events:delete',
    'bot:read', 'bot:write', 'bot:delete',
    'user_activity_log:read', 
    'ai-persona:read', 'ai-persona:write', 'ai-persona:delete', 'ai-persona:update', 'ai-persona:assign',
    'company-ai-config:read', 'company-ai-config:write', 'company-ai-config:delete',
    'marketing-campaign:read', 'marketing-campaign:write', 'marketing-campaign:update', 'marketing-campaign:delete', 'marketing-campaign:manage',
  ],
  [RolesEnum.ROOT_READONLY]: [
    'sensitive:operations',
    'root:access',
    'system:read',
    'user:read',
    'role:read',
    'storage:read', 'storage:manage',
    'company:read',
    'ai-assistant:read',
    'company_schedules:read',
    'company_events:read',
    'user_activity_log:read',
    'ai-persona:read',
    'company-ai-config:read',
    'marketing-campaign:read',
  ],
  [RolesEnum.ADMIN]: [
    'sensitive:operations',
    'auth:write',
    'user:read', 'user:write', 'user:delete',
    'role:read',
    'storage:read', 'storage:write', 'storage:delete', 'storage:manage',
    'company:read', 'company:write',
    'ai-assistant:read',
    'company-user:assign', 'company-user:remove',
    'company_schedules:read', 'company_schedules:write', 'company_schedules:delete',
    'company_events:read', 'company_events:write', 'company_events:delete',
    'user_activity_log:read',
    'ai-persona:read', 'ai-persona:write', 'ai-persona:delete', 'ai-persona:update', 'ai-persona:assign',
    'company-ai-config:read', 'company-ai-config:write', 'company-ai-config:delete',
    'marketing-campaign:read', 'marketing-campaign:write', 'marketing-campaign:update', 'marketing-campaign:delete', 'marketing-campaign:manage',
  ],
  [RolesEnum.MANAGER]: [
    'sensitive:operations',
    'auth:write',
    'user:read', 'user:write', 'user:delete',
    'role:read',
    'storage:manage', 'storage:write', 'storage:read',
    'company:read',
    'ai-assistant:read',
    'company_schedules:read', 'company_schedules:write', 'company_schedules:delete',
    'company_events:read', 'company_events:write', 'company_events:delete',
    'user_activity_log:read',
    'company-ai-config:read',
  ],
  [RolesEnum.SALES_AGENT]: [
    'sensitive:operations',
    'user:read',
    'role:read',
    'storage:manage', 'storage:write', 'storage:read',
    'company:read',
    'ai-assistant:read',
    'company_schedules:read',
    'company_events:read',
    'user_activity_log:read',
    'company-ai-config:read',
  ],
  [RolesEnum.HOST]: [
    'sensitive:operations',
    'user:read',
    'role:read',
    'storage:manage', 'storage:write', 'storage:read',
    'company:read',
    'ai-assistant:read',
    'company_schedules:read',
    'company_events:read',
    'user_activity_log:read',
    'company-ai-config:read',
  ],
  [RolesEnum.GUEST]: [
    'sensitive:operations',
    'user:read',
    'company:read',
    'company_schedules:read',
    'company_events:read',
    'user_activity_log:read',
  ],
};

// Helper function to check if a role is excluded from a permission
async function isRoleExcluded(
  roleName: string, 
  excludeRoles: string[] | null, 
  prisma: PrismaClient
): Promise<boolean> {
  if (!excludeRoles || excludeRoles.length === 0) {
    return false; // No exclusions, role is allowed
  }
  
  if (excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.ALL_ROLES)) {
    return true; // All roles are excluded
  }

  // Check if using "all except" pattern
  if (excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT)) {
    const exceptRoles = excludeRoles.filter(role => role !== PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT);
    return !exceptRoles.includes(roleName); // Exclude if NOT in the exception list
  }

  // Check if using "allow custom roles plus listed" pattern
  if (excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.ALLOW_CUSTOM_AND_LISTED)) {
    const allowedRoles = excludeRoles.filter(role => role !== PERMISSION_EXCLUDE_SYMBOLS.ALLOW_CUSTOM_AND_LISTED);
    const role = await prisma.role.findUnique({
      where: { name: roleName }
    });
    
    // Allow if it's a custom role OR if it's in the allowed list
    if (role && !role.isDefaultAppRole) {
      return false; // Custom role is allowed
    }
    
    return !allowedRoles.includes(roleName); // Exclude if NOT in the allowed list
  }
  
  // Check if custom roles are excluded and this is a custom role
  if (excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.CUSTOM_ROLES)) {
    const role = await prisma.role.findUnique({
      where: { name: roleName }
    });
    if (role && !role.isDefaultAppRole) {
      return true; // This is a custom role and custom roles are excluded
    }
  }

  // Check if default roles are excluded and this is a default role
  if (excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.DEFAULT_ROLES)) {
    const role = await prisma.role.findUnique({
      where: { name: roleName }
    });
    if (role && role.isDefaultAppRole) {
      return true; // This is a default role and default roles are excluded
    }
  }
  
  return excludeRoles.includes(roleName); // Check if specific role is excluded
}

// Helper function to get the exclude reason for logging
async function getExcludeReason(
  roleName: string, 
  excludeRoles: string[] | null, 
  prisma: PrismaClient
): Promise<string> {
  if (!excludeRoles || excludeRoles.length === 0) {
    return '';
  }

  if (excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.ALL_ROLES)) {
    return 'ALL_ROLES excluded (only explicit role-permissions-map assignments allowed)';
  }

  if (excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT)) {
    const exceptRoles = excludeRoles.filter(role => role !== PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT);
    if (!exceptRoles.includes(roleName)) {
      return `ALL_EXCEPT pattern - only [${exceptRoles.join(', ')}] are allowed`;
    }
  }

  if (excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.ALLOW_CUSTOM_AND_LISTED)) {
    const allowedRoles = excludeRoles.filter(role => role !== PERMISSION_EXCLUDE_SYMBOLS.ALLOW_CUSTOM_AND_LISTED);
    const role = await prisma.role.findUnique({
      where: { name: roleName }
    });
    
    if (role && role.isDefaultAppRole && !allowedRoles.includes(roleName)) {
      return `ALLOW_CUSTOM_AND_LISTED pattern - only custom roles and [${allowedRoles.join(', ')}] are allowed`;
    }
  }

  if (excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.CUSTOM_ROLES)) {
    const role = await prisma.role.findUnique({
      where: { name: roleName }
    });
    if (role && !role.isDefaultAppRole) {
      return 'CUSTOM_ROLES excluded';
    }
  }

  if (excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.DEFAULT_ROLES)) {
    const role = await prisma.role.findUnique({
      where: { name: roleName }
    });
    if (role && role.isDefaultAppRole) {
      return 'DEFAULT_ROLES excluded (only custom roles allowed)';
    }
  }

  if (excludeRoles.includes(roleName)) {
    return `Role '${roleName}' specifically excluded`;
  }

  return '';
}

export default async function main(prisma: PrismaClient) {
  // First, analyze and report on exclude patterns used
  console.log('\n🔍 Analyzing permission exclude patterns...');
  const excludePatternStats = {
    [PERMISSION_EXCLUDE_SYMBOLS.ALL_ROLES]: 0,
    [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT]: 0,
    [PERMISSION_EXCLUDE_SYMBOLS.ALLOW_CUSTOM_AND_LISTED]: 0,
    [PERMISSION_EXCLUDE_SYMBOLS.CUSTOM_ROLES]: 0,
    [PERMISSION_EXCLUDE_SYMBOLS.DEFAULT_ROLES]: 0,
    'specific_roles': 0,
    'allow_all': 0
  };

  for (const permission of permissions) {
    if (!permission.excludeRoles) {
      excludePatternStats['allow_all']++;
    } else if (permission.excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.ALL_ROLES)) {
      excludePatternStats[PERMISSION_EXCLUDE_SYMBOLS.ALL_ROLES]++;
    } else if (permission.excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT)) {
      excludePatternStats[PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT]++;
    } else if (permission.excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.ALLOW_CUSTOM_AND_LISTED)) {
      excludePatternStats[PERMISSION_EXCLUDE_SYMBOLS.ALLOW_CUSTOM_AND_LISTED]++;
    } else if (permission.excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.CUSTOM_ROLES)) {
      excludePatternStats[PERMISSION_EXCLUDE_SYMBOLS.CUSTOM_ROLES]++;
    } else if (permission.excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.DEFAULT_ROLES)) {
      excludePatternStats[PERMISSION_EXCLUDE_SYMBOLS.DEFAULT_ROLES]++;
    } else {
      excludePatternStats['specific_roles']++;
    }
  }

  console.log('📊 Exclude pattern usage:');
  console.log(`   🟢 ALLOW_ALL (null): ${excludePatternStats['allow_all']} permissions`);
  console.log(`   🔴 ALL_ROLES (*): ${excludePatternStats[PERMISSION_EXCLUDE_SYMBOLS.ALL_ROLES]} permissions`);
  console.log(`   🟡 ALL_EXCEPT (*!): ${excludePatternStats[PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT]} permissions`);
  console.log(`   🟣 ALLOW_CUSTOM_AND_LISTED (*+): ${excludePatternStats[PERMISSION_EXCLUDE_SYMBOLS.ALLOW_CUSTOM_AND_LISTED]} permissions`);
  console.log(`   🔵 CUSTOM_ROLES (**): ${excludePatternStats[PERMISSION_EXCLUDE_SYMBOLS.CUSTOM_ROLES]} permissions`);
  console.log(`   🟠 DEFAULT_ROLES (***): ${excludePatternStats[PERMISSION_EXCLUDE_SYMBOLS.DEFAULT_ROLES]} permissions`);
  console.log(`   ⚫ Specific roles: ${excludePatternStats['specific_roles']} permissions`);

  // Assign permissions to roles with exclude validation
  console.log('\n🔧 Assigning permissions to roles with exclude rule validation...');
  let totalAssigned = 0;
  let totalSkipped = 0;
  
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

    let assignedCount = 0;
    let skippedCount = 0;

    // Add new permissions for this role
    for (const permissionName of permissionNames) {
      const permissionConfig = permissions.find(p => p.name === permissionName);
      
      if (!permissionConfig) {
        console.error(`Permission ${permissionName} not declared in seed-permissions.ts`);
        continue;
      }

      // Check if role is excluded from this permission
      if (await isRoleExcluded(roleName, permissionConfig.excludeRoles, prisma)) {
        const excludeReason = await getExcludeReason(roleName, permissionConfig.excludeRoles, prisma);
        console.warn(`⚠️  Role ${roleName} is excluded from permission ${permissionName} - SKIPPING`);
        console.warn(`   📋 Reason: ${excludeReason}`);
        skippedCount++;
        continue;
      }

      const permission = await prisma.permission.findUnique({
        where: { name: permissionName },
      });

      if (!permission) {
        console.error(`Permission ${permissionName} not found in database`);
        continue;
      }

      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
      
      assignedCount++;
    }

    console.log(`✅ Role ${roleName}: ${assignedCount} permissions assigned, ${skippedCount} skipped due to exclude rules`);
    totalAssigned += assignedCount;
    totalSkipped += skippedCount;
  }
  
  console.log(`\n📊 Final Summary:`);
  console.log(`   ✅ ${totalAssigned} permissions assigned successfully`);
  console.log(`   ⚠️  ${totalSkipped} permissions skipped due to exclude rules`);
  console.log(`   📈 Total operations: ${totalAssigned + totalSkipped}`);
  
  if (totalSkipped > 0) {
    console.log(`\n💡 Note: Skipped permissions are working as intended - they respect the exclude rules defined in seed-permissions.ts`);
    console.log(`   Use the logs above to verify that the exclude patterns are working correctly.`);
  } else {
    console.log(`\n🎉 All requested permissions were assigned successfully with no exclusions applied.`);
  }
}
