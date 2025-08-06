# Admin Password Change Feature

## Overview
This feature allows root and admin users to change passwords of other users with proper authorization controls.

## Endpoint
- **URL**: `POST /api/auth/admin/change-password`
- **Authentication**: Required (JWT Bearer Token)
- **Authorization**: Root or Admin roles only

## Request Body
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "password": "NewSecureP@ssw0rd123"
}
```

## Authorization Rules

### Root Users
- ✅ Can change password of **any user** in the system
- ✅ No company restrictions
- ✅ Full administrative privileges

### Admin Users  
- ✅ Can change password of users **only within their company**
- ❌ Cannot change passwords of users from other companies
- ✅ Must belong to a company themselves

### Other Roles
- ❌ Sales agents, managers, guests, etc. cannot access this endpoint
- ❌ Will receive 403 Forbidden error

## Validation

### Password Requirements
- Minimum 8 characters
- Maximum 100 characters
- Must contain:
  - At least one lowercase letter
  - At least one uppercase letter  
  - At least one number
  - At least one special character (@$!%*?&)

### User ID Validation
- Must be a valid UUID v4 format
- Target user must exist in the system

## Response Examples

### Success Response (200)
```json
{
  "success": true,
  "message": "Password updated successfully for user user@example.com"
}
```

### Error Responses

#### Target User Not Found (404)
```json
{
  "message": "User with ID 550e8400-e29b-41d4-a716-446655440000 not found",
  "error": "Not Found",
  "statusCode": 404
}
```

#### Insufficient Permissions (403)
```json
{
  "message": "Admin can only change passwords of users in the same company",
  "error": "Forbidden", 
  "statusCode": 403
}
```

#### Invalid Password Format (400)
```json
{
  "message": [
    "password must contain at least one lowercase letter, one uppercase letter, one number, and one special character"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

## Security Features

1. **Role-based Access Control**: Only root and admin users can access
2. **Company Isolation**: Admins can only affect users in their company
3. **Password Hashing**: Uses bcrypt with 12 salt rounds
4. **Transaction Safety**: Password changes are atomic operations
5. **Audit Trail**: All operations are logged
6. **Input Validation**: Strong password requirements enforced

## Implementation Details

### Files Created/Modified
- `src/application/dtos/requests/auth/admin-change-password.dto.ts` - Request DTO
- `src/application/commands/auth/admin-change-password.command.ts` - Command & Handler
- `src/presentation/modules/auth/auth.controller.ts` - Endpoint added
- `src/presentation/modules/auth/auth.module.ts` - Handler registered
- `src/application/commands/auth/admin-change-password.command.spec.ts` - Unit tests

### Architecture Compliance
- ✅ Follows Clean Architecture principles
- ✅ Uses CQRS pattern with Commands
- ✅ Proper separation of concerns
- ✅ Transaction-wrapped for data consistency
- ✅ Full test coverage

## Usage Examples

### Root User Changes Any Password
```bash
curl -X POST http://localhost:3000/api/auth/admin/change-password \
  -H "Authorization: Bearer <root_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "any-user-id",
    "password": "NewSecureP@ssw0rd123"
  }'
```

### Admin User Changes Company User Password
```bash
curl -X POST http://localhost:3000/api/auth/admin/change-password \
  -H "Authorization: Bearer <admin_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "same-company-user-id", 
    "password": "NewSecureP@ssw0rd123"
  }'
```