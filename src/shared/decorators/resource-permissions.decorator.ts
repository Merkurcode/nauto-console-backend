// No imports needed
import { RequirePermissions } from './permissions.decorator';

/**
 * Helper decorator for requiring read permission on a resource
 */
export const CanRead = (resource: string) => RequirePermissions(`${resource}:read`);

/**
 * Helper decorator for requiring write permission on a resource
 */
export const CanWrite = (resource: string) => RequirePermissions(`${resource}:write`);

/**
 * Helper decorator for requiring delete permission on a resource
 */
export const CanDelete = (resource: string) => RequirePermissions(`${resource}:delete`);

/**
 * Helper decorator for requiring update permission on a resource
 */
export const CanUpdate = (resource: string) => RequirePermissions(`${resource}:update`);

/**
 * Helper decorator for requiring assign permission on a resource
 */
export const CanAssign = (resource: string) => RequirePermissions(`${resource}:assign`);

/**
 * Helper decorator for requiring multiple permissions on a resource
 */
export const ResourcePermissions = (resource: string, actions: string[]) => {
  const permissions = actions.map(action => `${resource}:${action}`);

  return RequirePermissions(...permissions);
};

/**
 * Helper decorator for requiring full access (read, write, delete) on a resource
 */
export const FullResourceAccess = (resource: string) =>
  ResourcePermissions(resource, ['read', 'write', 'delete']);
