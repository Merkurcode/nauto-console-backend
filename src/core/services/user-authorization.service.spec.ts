import { Test, TestingModule } from '@nestjs/testing';
import { UserAuthorizationService } from './user-authorization.service';
import { User } from '@core/entities/user.entity';
import { Role } from '@core/entities/role.entity';
import { Email } from '@core/value-objects/email.vo';
import { FirstName, LastName } from '@core/value-objects/name.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { RoleId } from '@core/value-objects/role-id.vo';
import { Permission } from '@core/entities/permission.entity';
import { ResourceAction, ActionType } from '@core/value-objects/resource-action.vo';
import { RolesEnum } from '@shared/constants/enums';

describe('UserAuthorizationService - Role Hierarchy Tests', () => {
  let service: UserAuthorizationService;
  let rootUser: User;
  let rootReadonlyUser: User;
  let adminUser: User;
  let managerUser: User;
  let salesAgentUser: User;
  let guestUser: User;
  let rootRole: Role;
  let rootReadonlyRole: Role;
  let adminRole: Role;
  let managerRole: Role;
  let salesAgentRole: Role;
  let guestRole: Role;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserAuthorizationService],
    }).compile();

    service = module.get<UserAuthorizationService>(UserAuthorizationService);

    // Create test roles - Root should have system-level permissions, not admin business permissions
    rootRole = createRoleWithPermissions(RolesEnum.ROOT, 'Root role', [
      'system:read', 'system:write', 'system:delete', 'system:manage',
      'company:read', 'company:write'
    ], 1);

    rootReadonlyRole = createRoleWithPermissions(RolesEnum.ROOT_READONLY, 'Root readonly role', [
      'user:read', 'role:read', 'company:read', 'system:read'
    ], 2);

    adminRole = createRoleWithPermissions(RolesEnum.ADMIN, 'Admin role', [
      'user:read', 'user:write', 'user:delete',  // Admin permissions that trigger hasAdminPermissions()
      'role:read',
      'company:read'
    ], 3);

    managerRole = createRoleWithPermissions(RolesEnum.MANAGER, 'Manager role', [
      'user:read', 'company:read'
    ], 4);

    salesAgentRole = createRoleWithPermissions(RolesEnum.SALES_AGENT, 'Sales agent role', [
      'company:read'
    ], 5);

    guestRole = createRoleWithPermissions(RolesEnum.GUEST, 'Guest role', [], 6, true);

    // Create test users with different roles
    rootUser = createUserWithRoles('root@test.com', [rootRole]);
    rootReadonlyUser = createUserWithRoles('root_readonly@test.com', [rootReadonlyRole]);
    adminUser = createUserWithRoles('admin@test.com', [adminRole]);
    managerUser = createUserWithRoles('manager@test.com', [managerRole]);
    salesAgentUser = createUserWithRoles('sales@test.com', [salesAgentRole]);
    guestUser = createUserWithRoles('guest@test.com', [guestRole]);
  });

  describe('Root Operations Access Control', () => {
    it('should allow root user to access root features', () => {
      expect(service.canAccessRootFeatures(rootUser)).toBe(true);
    });

    it('should allow root_readonly user to access root features', () => {
      expect(service.canAccessRootFeatures(rootReadonlyUser)).toBe(true);
    });

    it('should deny admin user access to root features', () => {
      expect(service.canAccessRootFeatures(adminUser)).toBe(false);
    });

    it('should deny manager user access to root features', () => {
      expect(service.canAccessRootFeatures(managerUser)).toBe(false);
    });

    it('should deny sales agent user access to root features', () => {
      expect(service.canAccessRootFeatures(salesAgentUser)).toBe(false);
    });

    it('should deny guest user access to root features', () => {
      expect(service.canAccessRootFeatures(guestUser)).toBe(false);
    });
  });

  describe('Admin Operations Access Control', () => {
    it('should not allow root user to access admin features (different role hierarchy)', () => {
      expect(service.canAccessAdminFeatures(rootUser)).toBe(false); // Root doesn't have admin role
    });

    it('should allow admin user to access admin features', () => {
      expect(service.canAccessAdminFeatures(adminUser)).toBe(true);
    });

    it('should deny manager user access to admin features', () => {
      expect(service.canAccessAdminFeatures(managerUser)).toBe(false);
    });

    it('should deny sales agent user access to admin features', () => {
      expect(service.canAccessAdminFeatures(salesAgentUser)).toBe(false);
    });

    it('should deny guest user access to admin features', () => {
      expect(service.canAccessAdminFeatures(guestUser)).toBe(false);
    });
  });

  describe('Role Assignment Restrictions', () => {
    it('should allow root user to assign root roles to eligible users', () => {
      // Create a user that already has root privileges to be eligible for additional role assignment
      const rootEligibleUser = createUserWithRoles('root_eligible@test.com', [rootRole]);
      // Test assignment of root_readonly to user that already has root (should work)
      expect(service.canAssignRole(rootUser, rootEligibleUser, rootReadonlyRole)).toBe(true);
      
      // Only users with full root role can receive additional root roles
      // This reflects the business rule that root_readonly is not eligible for full root
      const newRootUser = createUserWithRoles('new_root@test.com', [rootRole]);
      expect(service.canAssignRole(rootUser, newRootUser, rootReadonlyRole)).toBe(true);
    });

    it('should deny admin user from assigning root roles', () => {
      expect(service.canAssignRole(adminUser, managerUser, rootRole)).toBe(false);
      expect(service.canAssignRole(adminUser, managerUser, rootReadonlyRole)).toBe(false);
    });

    it('should allow admin user to assign admin roles', () => {
      expect(service.canAssignRole(adminUser, managerUser, adminRole)).toBe(true);
    });

    it('should deny manager user from assigning admin roles', () => {
      expect(service.canAssignRole(managerUser, salesAgentUser, adminRole)).toBe(false);
    });

    it('should deny sales agent from assigning any roles', () => {
      expect(service.canAssignRole(salesAgentUser, guestUser, managerRole)).toBe(false);
    });

    it('should deny guest from assigning any roles', () => {
      expect(service.canAssignRole(guestUser, salesAgentUser, salesAgentRole)).toBe(false);
    });
  });

  describe('Role Deletion Restrictions', () => {
    it('should allow root user to delete root roles', () => {
      expect(service.canDeleteRole(rootUser, rootRole)).toBe(true);
      expect(service.canDeleteRole(rootUser, rootReadonlyRole)).toBe(true);
    });

    it('should deny admin user from deleting root roles', () => {
      expect(service.canDeleteRole(adminUser, rootRole)).toBe(false);
      expect(service.canDeleteRole(adminUser, rootReadonlyRole)).toBe(false);
    });

    it('should allow admin user to delete regular roles (if has permission)', () => {
      // Admin needs role:delete permission to delete roles
      const adminWithDeletePerm = createUserWithRoles('admin_delete@test.com', [
        createRoleWithPermissions('admin_with_delete', 'Admin with delete', [
          'role:delete', 'user:read', 'company:read'
        ], 3)
      ]);
      expect(service.canDeleteRole(adminWithDeletePerm, managerRole)).toBe(true);
    });

    it('should deny manager from deleting any roles', () => {
      expect(service.canDeleteRole(managerUser, managerRole)).toBe(false);
    });
  });

  describe('Resource Access Control', () => {
    it('should enforce resource permissions correctly', () => {
      // Root can access system resources
      expect(service.canAccessResource(rootUser, 'system', 'read')).toBe(true);
      expect(service.canAccessResource(rootUser, 'system', 'write')).toBe(true);

      // Admin cannot access system resources
      expect(service.canAccessResource(adminUser, 'system', 'read')).toBe(false);
      expect(service.canAccessResource(adminUser, 'system', 'write')).toBe(false);

      // Manager can only read company info
      expect(service.canAccessResource(managerUser, 'company', 'read')).toBe(true);
      expect(service.canAccessResource(managerUser, 'company', 'write')).toBe(false);

      // Sales agent has limited access
      expect(service.canAccessResource(salesAgentUser, 'company', 'read')).toBe(true);
      expect(service.canAccessResource(salesAgentUser, 'user', 'read')).toBe(false);
    });
  });

  describe('Security Level Hierarchy', () => {
    it('should assign correct security levels based on role hierarchy', () => {
      // Root with 2FA should be maximum
      const rootUserWith2FA = createUserWithRoles('root_2fa@test.com', [rootRole]);
      rootUserWith2FA.enableTwoFactor('test-secret');
      expect(service.getUserSecurityLevel(rootUserWith2FA)).toBe('maximum');

      // Root without 2FA should be critical
      expect(service.getUserSecurityLevel(rootUser)).toBe('critical');

      // Admin with 2FA should be critical
      const adminUserWith2FA = createUserWithRoles('admin_2fa@test.com', [adminRole]);
      adminUserWith2FA.enableTwoFactor('test-secret');
      expect(service.getUserSecurityLevel(adminUserWith2FA)).toBe('critical');

      // Admin without 2FA should be high
      expect(service.getUserSecurityLevel(adminUser)).toBe('high');

      // Manager with 2FA should be medium
      const managerUserWith2FA = createUserWithRoles('manager_2fa@test.com', [managerRole]);
      managerUserWith2FA.enableTwoFactor('test-secret');
      expect(service.getUserSecurityLevel(managerUserWith2FA)).toBe('medium');

      // Guest should be low
      expect(service.getUserSecurityLevel(guestUser)).toBe('low');
    });
  });

  describe('Audit Logging Requirements', () => {
    it('should require logging for root users always', () => {
      expect(service.shouldLogAccess(rootUser, 'any-resource')).toBe(true);
      expect(service.shouldLogAccess(rootReadonlyUser, 'any-resource')).toBe(true);
    });

    it('should require logging for admin users always', () => {
      expect(service.shouldLogAccess(adminUser, 'any-resource')).toBe(true);
    });

    it('should require logging for sensitive resources', () => {
      expect(service.shouldLogAccess(managerUser, 'user')).toBe(true);
      expect(service.shouldLogAccess(managerUser, 'role')).toBe(true);
      expect(service.shouldLogAccess(managerUser, 'system')).toBe(true);
      expect(service.shouldLogAccess(managerUser, 'company')).toBe(true);
    });

    it('should not require logging for non-sensitive resources by regular users', () => {
      expect(service.shouldLogAccess(salesAgentUser, 'product')).toBe(false);
      expect(service.shouldLogAccess(guestUser, 'public-info')).toBe(false);
    });
  });

  describe('Role Hierarchy Privilege Tests', () => {
    it('should verify admin cannot perform root operations', () => {
      expect(service.canAccessRootFeatures(adminUser)).toBe(false);
      expect(service.canAssignRole(adminUser, managerUser, rootRole)).toBe(false);
      expect(service.canDeleteRole(adminUser, rootRole)).toBe(false);
    });

    it('should verify manager cannot perform admin operations', () => {
      expect(service.canAccessAdminFeatures(managerUser)).toBe(false);
      expect(service.canAssignRole(managerUser, salesAgentUser, adminRole)).toBe(false);
    });

    it('should verify sales agent cannot perform manager operations', () => {
      expect(service.canAssignRole(salesAgentUser, guestUser, managerRole)).toBe(false);
      expect(service.canDeleteRole(salesAgentUser, managerRole)).toBe(false);
    });

    it('should verify guest has no administrative privileges', () => {
      expect(service.canAccessAdminFeatures(guestUser)).toBe(false);
      expect(service.canAccessRootFeatures(guestUser)).toBe(false);
      expect(service.canAssignRole(guestUser, salesAgentUser, salesAgentRole)).toBe(false);
    });

    it('should verify root can perform all operations', () => {
      expect(service.canAccessRootFeatures(rootUser)).toBe(true);
      // Create a user that already has root privileges for assignment test
      const rootEligibleUser = createUserWithRoles('root_eligible2@test.com', [rootRole]);
      expect(service.canAssignRole(rootUser, rootEligibleUser, rootReadonlyRole)).toBe(true);
      expect(service.canDeleteRole(rootUser, adminRole)).toBe(true);
    });

    it('should verify root_readonly has read access only', () => {
      expect(service.canAccessRootFeatures(rootReadonlyUser)).toBe(true);
      expect(service.canAccessResource(rootReadonlyUser, 'user', 'read')).toBe(true);
      expect(service.canAccessResource(rootReadonlyUser, 'user', 'write')).toBe(false);
      expect(service.canAccessResource(rootReadonlyUser, 'user', 'delete')).toBe(false);
    });
  });

  // Helper functions
  function createRoleWithPermissions(name: string, description: string, permissionNames: string[], hierarchyLevel: number, isDefault: boolean = false): Role {
    const role = Role.create(name, description, hierarchyLevel, isDefault);
    
    permissionNames.forEach(permName => {
      const [resource, action] = permName.split(':');
      const resourceAction = new ResourceAction(resource, action as ActionType);
      const permission = Permission.create(resourceAction, `Permission for ${permName}`);
      // Use direct property access to bypass business rules for tests
      (role as any)._permissions.push(permission);
    });

    return role;
  }

  function createUserWithRoles(email: string, roles: Role[]): User {
    const user = User.create(
      new Email(email),
      'hashed-password', 
      new FirstName('Test'),
      new LastName('User')
    );

    // Activate user and verify email for complete account
    user.activate();
    user.markEmailAsVerified();

    // For test purposes, force-assign roles bypassing business rules
    roles.forEach(role => {
      // Use direct property access to bypass the addRole business rules
      (user as any)._roles.push(role);
    });

    return user;
  }
});