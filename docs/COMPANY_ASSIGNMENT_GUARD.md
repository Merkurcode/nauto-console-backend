# Company Assignment Guard

## Overview

The `CompanyAssignmentGuard` ensures that users are assigned to a company before they can access protected endpoints. This is critical for multi-tenant applications where users must belong to a specific company/tenant to access resources.

## Features

- ✅ **Blocks unassigned users**: Users without `companyId` or `tenantId` cannot access protected resources
- ✅ **Root user bypass**: Users with root privileges can access resources without company assignment
- ✅ **Selective enforcement**: Use decorators to skip validation for specific endpoints
- ✅ **Clear error messages**: Provides helpful error messages for blocked users
- ✅ **Comprehensive logging**: Logs all access attempts for security auditing

## Usage

### 1. Require Company Assignment (Recommended)

Use the `@RequireCompanyAssignment()` decorator to enforce company assignment:

```typescript
import { RequireCompanyAssignment } from '@shared';

@Controller('api/company-data')
export class CompanyDataController {
  
  @Get('/dashboard')
  @RequireCompanyAssignment()
  async getDashboard() {
    // Only users assigned to a company can access this
  }
}
```

### 2. Skip Company Assignment (When Needed)

Use the `@SkipCompanyAssignment()` decorator to allow access without company assignment:

```typescript
import { SkipCompanyAssignment } from '@shared';

@Controller('api/public')
export class PublicController {
  
  @Get('/system-info')
  @SkipCompanyAssignment()
  async getSystemInfo() {
    // This endpoint is accessible even without company assignment
  }
}
```

### 3. Global Application

To apply company assignment validation globally, add the guard to your application:

```typescript
// In your main module or controller
import { CompanyAssignmentGuard } from '@presentation/guards/company-assignment.guard';

@Controller()
@UseGuards(JwtAuthGuard, CompanyAssignmentGuard)
export class AppController {
  // All endpoints in this controller require company assignment
}
```

## Guard Behavior

### ✅ Allows Access:
- Users with valid `companyId` or `tenantId` 
- Root users (with root permissions)
- Endpoints decorated with `@SkipCompanyAssignment()`
- When no user is present (lets JWT guard handle authentication)

### ❌ Blocks Access:
- Users without company assignment (`!companyId && !tenantId`)
- Non-root users trying to access company-protected resources

### Error Response:
```json
{
  "statusCode": 403,
  "message": "Access denied. Your account must be assigned to a company to access this resource. Please contact your administrator.",
  "error": "Forbidden"
}
```

## Security Considerations

1. **Defense in Depth**: This guard works alongside JWT authentication, not as a replacement
2. **Root Bypass**: Root users can bypass this guard - ensure root permissions are properly protected
3. **Logging**: All access attempts are logged for security monitoring
4. **Multi-tenant Isolation**: Works in conjunction with tenant isolation mechanisms

## Common Use Cases

### 1. Company-Specific Resources
```typescript
@Get('/reports')
@RequireCompanyAssignment()
async getCompanyReports(@CurrentUser() user: IJwtPayload) {
  // User guaranteed to have company assignment
  const companyId = user.companyId || user.tenantId;
  return this.reportService.getReports(companyId);
}
```

### 2. Public Endpoints
```typescript
@Get('/health')
@SkipCompanyAssignment()
async getHealth() {
  // Public health check - no company required
  return { status: 'ok' };
}
```

### 3. Admin Setup Flows
```typescript
@Post('/initial-setup')
@SkipCompanyAssignment()
async initialSetup(@Body() setupDto: SetupDto) {
  // Initial system setup - before companies are created
  return this.setupService.initialize(setupDto);
}
```

## Integration with Existing Guards

This guard should be used **after** authentication guards:

```typescript
@Controller('api/secure')
@UseGuards(JwtAuthGuard, CompanyAssignmentGuard, PermissionsGuard)
export class SecureController {
  // Guard execution order:
  // 1. JwtAuthGuard (authentication)
  // 2. CompanyAssignmentGuard (company assignment)
  // 3. PermissionsGuard (authorization)
}
```

## Troubleshooting

### Users Getting "Access Denied" Errors

1. **Check Company Assignment**: Verify user has `companyId` or `tenantId` in JWT token
2. **Review Decorators**: Ensure endpoints that should be public use `@SkipCompanyAssignment()`
3. **Root Users**: Confirm root users have proper permissions if they should bypass this guard

### Guard Not Working

1. **Import Order**: Ensure the guard is imported after JWT authentication
2. **Decorator Import**: Check that decorators are imported from the correct path
3. **User Context**: Verify that `request.user` is populated by JWT guard

## Testing

```typescript
// Example test for the guard
describe('CompanyAssignmentGuard', () => {
  it('should block users without company assignment', async () => {
    const user = { sub: '123', companyId: null, tenantId: null };
    request.user = user;
    
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should allow users with company assignment', async () => {
    const user = { sub: '123', companyId: 'company-123' };
    request.user = user;
    
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });
});
```