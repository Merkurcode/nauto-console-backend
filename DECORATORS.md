# Comprehensive Decorator Documentation

This document provides a complete reference of all custom decorators used in the NestJS backend application for tracking and informational purposes.

## Table of Contents
- [Authentication & User Context](#authentication--user-context)
- [Authorization & Permissions](#authorization--permissions)
- [Role-Based Access](#role-based-access)
- [Special Access Control](#special-access-control)
- [Composite Operations](#composite-operations)
- [Bot Management](#bot-management)
- [Tenant Management](#tenant-management)
- [Rate Limiting](#rate-limiting)
- [Security & Sensitive Operations](#security--sensitive-operations)
- [Invitation & User Management](#invitation--user-management)
- [Guard Integration](#guard-integration)
- [Usage Patterns](#usage-patterns)

---

## Authentication & User Context

### `@CurrentUser()`
- **File**: `src/shared/decorators/current-user.decorator.ts`
- **Type**: Parameter decorator
- **Purpose**: Extracts the current authenticated user from the request context
- **Usage**: 
  ```typescript
  async getProfile(@CurrentUser() user: IJwtPayload) {
    return user;
  }
  ```
- **Guard Integration**: Works with JWT authentication guards

### `@LightweightAuth()`
- **File**: `src/shared/decorators/lightweight-auth.decorator.ts`
- **Type**: Method decorator
- **Purpose**: JWT validation minimalista sin queries pesadas a BD - perfect for endpoints that only need JWT claims
- **Skips**: User profile loading, roles/permissions loading, session activity updates, validation chains
- **Usage**: 
  ```typescript
  @Get('me')
  @LightweightAuth()
  async me(@CurrentUser() user: IJwtPayload) {
    return { id: user.sub, email: user.email };
  }
  ```
- **Guard Integration**: Processed by `JwtAuthGuard` with minimal validation

### `@CurrentTenant()`
- **File**: `src/shared/decorators/tenant.decorator.ts`
- **Type**: Parameter decorator  
- **Purpose**: Extracts tenant ID from current user's context for multi-tenant operations
- **Usage**: 
  ```typescript
  async getTenantData(@CurrentTenant() tenantId: string) {
    return this.service.getByTenant(tenantId);
  }
  ```
- **Guard Integration**: Used with tenant isolation guards

---

## Authorization & Permissions

### `@RequirePermissions(...permissions: string[])`
- **File**: `src/shared/decorators/permissions.decorator.ts`
- **Type**: Method decorator
- **Purpose**: Requires specific permissions for endpoint access
- **Usage**: 
  ```typescript
  @RequirePermissions('user:read', 'user:write')
  async updateUser() { }
  ```
- **Guard Integration**: Works with `PermissionsGuard`

### `@CanRead(resource: string)`
- **File**: `src/shared/decorators/resource-permissions.decorator.ts`
- **Type**: Method decorator
- **Purpose**: Helper decorator for requiring read permission on a resource
- **Usage**: 
  ```typescript
  @CanRead('user')
  async getUsers() { }
  ```
- **Guard Integration**: Uses `PermissionsGuard` via `RequirePermissions`

### `@CanWrite(resource: string)`
- **File**: `src/shared/decorators/resource-permissions.decorator.ts`
- **Type**: Method decorator
- **Purpose**: Helper decorator for requiring write permission on a resource
- **Usage**: 
  ```typescript
  @CanWrite('user')
  async createUser() { }
  ```
- **Guard Integration**: Uses `PermissionsGuard` via `RequirePermissions`

### `@CanDelete(resource: string)`
- **File**: `src/shared/decorators/resource-permissions.decorator.ts`
- **Type**: Method decorator
- **Purpose**: Helper decorator for requiring delete permission on a resource
- **Usage**: 
  ```typescript
  @CanDelete('user')
  async deleteUser() { }
  ```
- **Guard Integration**: Uses `PermissionsGuard` via `RequirePermissions`

### `@ResourcePermissions(resource: string, actions: string[])`
- **File**: `src/shared/decorators/resource-permissions.decorator.ts`
- **Type**: Method decorator
- **Purpose**: Helper decorator for requiring multiple permissions on a resource
- **Usage**: 
  ```typescript
  @ResourcePermissions('user', ['read', 'write'])
  async updateUserProfile() { }
  ```
- **Guard Integration**: Uses `PermissionsGuard` via `RequirePermissions`

### `@FullResourceAccess(resource: string)`
- **File**: `src/shared/decorators/resource-permissions.decorator.ts`
- **Type**: Method decorator
- **Purpose**: Helper decorator for requiring full access (read, write, delete) on a resource
- **Usage**: 
  ```typescript
  @FullResourceAccess('user')
  async adminUserManagement() { }
  ```
- **Guard Integration**: Uses `PermissionsGuard` via `RequirePermissions`

---

## Role-Based Access

### `@Roles(...roles: RolesEnum[])`
- **File**: `src/shared/decorators/roles.decorator.ts`
- **Type**: Method decorator
- **Purpose**: Restricts endpoint access to users with specific roles
- **Usage**: 
  ```typescript
  @Roles(RolesEnum.ADMIN, RolesEnum.MANAGER)
  async adminOnlyEndpoint() { }
  ```
- **Guard Integration**: Works with role-based guards

### `@RequiresAdmin()`
- **File**: `src/shared/decorators/admin.decorator.ts`
- **Type**: Method decorator
- **Purpose**: Marks endpoints as requiring admin access
- **Usage**: 
  ```typescript
  @RequiresAdmin()
  async systemConfiguration() { }
  ```
- **Guard Integration**: Works with `PermissionsGuard`

---

## Special Access Control

### `@Public()`
- **File**: `src/shared/decorators/public.decorator.ts`
- **Type**: Method decorator
- **Purpose**: Marks endpoints as publicly accessible (bypasses authentication)
- **Usage**: 
  ```typescript
  @Public()
  async login() { }
  ```
- **Guard Integration**: Recognized by JWT guards and tenant isolation guards

### `@DenyForRootReadOnly()`
- **File**: `src/shared/decorators/root-readonly.decorator.ts`
- **Type**: Method decorator
- **Purpose**: Prevents root_readonly users from accessing write operations
- **Usage**: 
  ```typescript
  @DenyForRootReadOnly()
  async createUser() { }
  ```
- **Guard Integration**: Works with `RootReadOnlyGuard`

### `@PreventRootAssignment()`
- **File**: `src/shared/decorators/prevent-root-assignment.decorator.ts`
- **Type**: Method decorator
- **Purpose**: Prevents non-root users from assigning ROOT or ROOT_READONLY roles
- **Usage**: 
  ```typescript
  @PreventRootAssignment()
  async assignUserRole() { }
  ```
- **Guard Integration**: Uses specialized permission checking logic

---

## Composite Operations

### `@WriteOperation(resource: string)`
- **File**: `src/shared/decorators/write-operation.decorator.ts`
- **Type**: Composite method decorator
- **Purpose**: Combines root readonly denial and write permission checking
- **Usage**: 
  ```typescript
  @WriteOperation('user')
  async updateUser() { }
  ```
- **Guard Integration**: Applies both `@DenyForRootReadOnly()` and `@CanWrite(resource)`

### `@DeleteOperation(resource: string)`
- **File**: `src/shared/decorators/write-operation.decorator.ts`
- **Type**: Composite method decorator
- **Purpose**: Combines root readonly denial and delete permission checking
- **Usage**: 
  ```typescript
  @DeleteOperation('user')
  async deleteUser() { }
  ```
- **Guard Integration**: Applies both `@DenyForRootReadOnly()` and `@CanDelete(resource)`

---

## Bot Management

### `@BotAccess()`
- **File**: `src/shared/decorators/bot-access.decorator.ts`
- **Type**: Method decorator
- **Purpose**: Marks endpoints as accessible for BOT role with optimized performance
- **Usage**: 
  ```typescript
  @BotAccess()
  async botOptimizedEndpoint() { }
  ```
- **Guard Integration**: Works with `BotOptimizationGuard`

### `@BotOnly()`
- **File**: `src/shared/decorators/bot-restrictions.decorator.ts`
- **Type**: Method decorator
- **Purpose**: Restricts endpoint access to BOT users only
- **Usage**: 
  ```typescript
  @BotOnly()
  async automatedTask() { }
  ```
- **Guard Integration**: Works with `BotRestrictionsGuard`

### `@NoBots()`
- **File**: `src/shared/decorators/bot-restrictions.decorator.ts`
- **Type**: Method decorator
- **Purpose**: Prevents BOT users from accessing an endpoint
- **Usage**: 
  ```typescript
  @NoBots()
  async logout() { }
  ```
- **Guard Integration**: Works with `BotRestrictionsGuard`

**Bot Decorator Behavior:**
- `@BotOnly()` and `@NoBots()` are mutually exclusive
- If both are applied to the same endpoint, `BotRestrictionsGuard` will log a warning and default to allowing access
- BOT users automatically get optimized performance through `BotOptimizationGuard` (skips session validation, user ban checks, etc.)

---

## Tenant Management

### `@SkipTenant()`
- **File**: `src/shared/decorators/skip-tenant.decorator.ts`
- **Type**: Method decorator
- **Purpose**: Skips tenant isolation on specific endpoints
- **Usage**: 
  ```typescript
  @SkipTenant()
  async globalSystemStats() { }
  ```
- **Guard Integration**: Works with `TenantIsolationGuard`

### `@RequireTenant()`
- **File**: `src/shared/decorators/tenant.decorator.ts`
- **Type**: Method decorator
- **Purpose**: Marks methods that require tenant context
- **Usage**: 
  ```typescript
  @RequireTenant()
  async getTenantSpecificData() { }
  ```
- **Guard Integration**: Used for metadata reflection

---

## Rate Limiting

### `@Throttle(ttl: number, limit: number)`
- **File**: `src/shared/decorators/throttle.decorator.ts`
- **Type**: Method decorator
- **Purpose**: Sets custom throttle limits for specific routes
- **Current Status**: **ACTIVE** - ThrottlerGuard is globally enabled
- **Default Limits**: 100 req/min globally, Auth endpoints: 5 req/min
- **Usage**: 
  ```typescript
  @Throttle(60, 10) // 10 requests per 60 seconds
  async intensiveOperation() { }
  ```
- **Response**: Returns HTTP 429 when limits exceeded with `X-RateLimit-*` headers
- **Guard Integration**: Works with `ThrottlerGuard` (executes FIRST in guard chain)

### `@SkipThrottle()`
- **File**: `src/shared/decorators/throttle.decorator.ts`
- **Type**: Method decorator
- **Purpose**: Skips throttling for specific routes (essential for health checks)
- **Current Status**: **FUNCTIONAL** - Required for internal endpoints
- **Usage**: 
  ```typescript
  @SkipThrottle()
  async internalHealthCheck() { }
  ```
- **Guard Integration**: Recognized by `ThrottlerGuard`
- **BOT Behavior**: BOT users automatically bypass throttling (no need for explicit @SkipThrottle)

---

## Security & Sensitive Operations

### `@RequiresSensitive()`
- **File**: `src/shared/decorators/sensitive.decorator.ts`
- **Type**: Method decorator
- **Purpose**: Marks endpoints as requiring sensitive operations (2FA)
- **Usage**: 
  ```typescript
  @RequiresSensitive()
  async changePassword() { }
  ```
- **Guard Integration**: Works with enhanced `PermissionsGuard`

---

## Invitation & User Management

### `@CanInvite(...roles: string[])`
- **File**: `src/shared/decorators/can-invite.decorator.ts`
- **Type**: Method decorator
- **Purpose**: Specifies which roles can be invited by the current user
- **Usage**: 
  ```typescript
  @CanInvite('manager', 'sales_agent')
  async inviteUser() { }
  ```
- **Guard Integration**: Uses specialized invitation permission logic

### `@RequiresResourceAction(resource: string, action: string)`
- **File**: `src/shared/decorators/resource-action.decorator.ts`
- **Type**: Method decorator
- **Purpose**: Specifies resource and action for permission checking (alternative approach)
- **Usage**: 
  ```typescript
  @RequiresResourceAction('user', 'create')
  async createUser() { }
  ```
- **Guard Integration**: Works with enhanced `PermissionsGuard`

---

## Guard Integration

**IMPORTANT ARCHITECTURAL CHANGE**: Guard consolidation has been implemented for better performance and maintainability.

The decorators work with the following **consolidated** guard system (in execution order):

1. **`ThrottlerGuard`** - **FIRST**: Rate limiting and DDoS protection (HTTP 429 responses)
2. **`JwtAuthGuard`** - **SECOND**: Consolidated authentication guard that includes:
   - JWT token validation
   - User ban checking (integrated)
   - Session validation (integrated) 
   - BOT optimization logic (integrated)
   - BOT access restrictions (integrated)
   - Tenant isolation (integrated)
   - Lightweight auth support

### Consolidated vs Legacy Guards

**✅ CURRENT (Consolidated)**:
- `ThrottlerGuard` → `JwtAuthGuard` (with all logic integrated)

**❌ LEGACY (Removed)**:
- ~~`UserBanGuard`~~ - Now integrated in `JwtAuthGuard.canActivate()`
- ~~`SessionGuard`~~ - Now integrated in `JwtAuthGuard.canActivate()`
- ~~`BotOptimizationGuard`~~ - Now integrated in `JwtAuthGuard.canActivate()`
- ~~`BotRestrictionsGuard`~~ - Now integrated in `JwtAuthGuard.canActivate()`
- ~~`TenantIsolationGuard`~~ - Now integrated in `JwtAuthGuard.canActivate()`

### Global Guards Configuration
Both guards are configured globally in `src/app.module.ts` with proper execution order:
1. ThrottlerGuard executes FIRST for DDoS protection
2. JwtAuthGuard executes SECOND with all consolidated validation logic

---

## Usage Patterns

### Common Controller Patterns

#### 1. **Protected Write Operations**
```typescript
@WriteOperation('user')
@RequirePermissions('user:write')
async createUser(@Body() createUserDto: CreateUserDto) { }
```

#### 2. **Role-Based with Permissions**
```typescript
@Roles(RolesEnum.ADMIN, RolesEnum.MANAGER)
@CanRead('company')
async getCompanyData() { }
```

#### 3. **Bot-Restricted Sensitive Operations**
```typescript
@NoBots()
@RequiresSensitive()
async logout() { }
```

#### 4. **Public Endpoints with Tenant Bypass**
```typescript
@Public()
@SkipTenant()
async healthCheck() { }
```

#### 5. **Throttled Auth Endpoints (NEW)**
```typescript
@Throttle(60, 5) // 5 requests per minute - ACTIVE throttling
@Public()
async login() { }
```

#### 6. **Bot-Only Automation Endpoints**
```typescript
@BotOnly()
@CanWrite('automation')
async executeAutomatedTask() { }
```

#### 7. **Lightweight Authentication (NEW)**
```typescript
@Get('me')
@LightweightAuth() // Skip heavy DB queries, only JWT validation
async getCurrentUser(@CurrentUser() user: IJwtPayload) {
  return { id: user.sub, email: user.email, roles: user.roles };
}
```

#### 8. **Health Check with Throttle Skip (CRITICAL)**
```typescript
@Get('health')
@Public()
@SkipThrottle() // REQUIRED for health checks to avoid 429 errors
async healthCheck() {
  return { status: 'ok' };
}
```

### Controller-Level vs Method-Level Application

Decorators can be applied at both controller and method levels:

- **Controller Level**: `@NoBots()` on entire controller blocks all BOT access to all methods
- **Method Level**: Individual method restrictions override or combine with controller-level settings
- **Combination**: Multiple decorators can be combined for fine-grained control

### Best Practices

1. **Use composite decorators** (`@WriteOperation`, `@DeleteOperation`) for common patterns
2. **Combine role and permission checks** for defense in depth
3. **Apply bot restrictions** at controller level when entire controllers should be bot-free
4. **Use public decorators sparingly** and always with proper validation
5. **Apply throttling strategically** - now ACTIVE globally with custom limits for auth endpoints
6. **Use @SkipThrottle() for internal endpoints** - Essential for health checks, monitoring, and internal APIs
7. **Use @LightweightAuth() for performance** - Perfect for simple profile/status endpoints that only need JWT claims
8. **BOT optimization is automatic** - BOT users automatically bypass throttling and get optimized performance
9. **Rate limiting headers** - All throttled responses now include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers
10. **HTTP 429 responses** - Proper rate limiting now returns HTTP 429 instead of HTTP 500 errors

---

## Metadata Keys Reference

Each decorator uses specific metadata keys for guard identification:

- `IS_PUBLIC_KEY` - Public endpoints
- `LIGHTWEIGHT_AUTH_KEY` - **NEW**: Lightweight JWT validation
- `PERMISSIONS_KEY` - Required permissions
- `ROLES_KEY` - Required roles
- `SKIP_AUTH_KEY` - Skip authentication
- `BOT_ACCESS_KEY` - Bot access optimization
- `BOT_ONLY_KEY` - Bot-only access
- `NO_BOTS_KEY` - Bot access prevention
- `SKIP_TENANT_KEY` - Skip tenant isolation
- `THROTTLE_KEY` - Custom throttle settings
- `SKIP_THROTTLE_KEY` - Skip throttling

This comprehensive decorator system provides fine-grained access control, multi-tenancy support, bot management, active rate limiting with HTTP 429 responses, and performance optimization through both guard consolidation and lightweight authentication for the NestJS application.