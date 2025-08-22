# Storage Controller Documentation

## Overview

The Storage module provides comprehensive file management capabilities with multipart upload support, quota management, and concurrency control. It follows Clean Architecture principles with complete separation of concerns.

## Architecture

### Controllers

1. **StorageController** (`/api/storage`)
   - Authenticated endpoints for file operations
   - Multipart upload management
   - File CRUD operations
   - Quota and concurrency management

2. **PublicStorageController** (`/api/public/storage`)
   - Unauthenticated access to public files
   - Stricter rate limiting for security

## Security Model

### Authentication & Authorization

All endpoints in `StorageController` require JWT authentication and role-based permissions:

- **Read Operations**: Require `file:read` permission
- **Write Operations**: Require `file:write` permission + RootReadOnlyGuard check
- **Delete Operations**: Require `file:delete` permission + RootReadOnlyGuard check
- **Admin Operations**: Require specific roles (ROOT, ADMIN)

### Public Access

The `PublicStorageController` provides unauthenticated access with restrictions:
- Only public files (`isPublic: true`) can be accessed
- Stricter rate limiting (30 requests/minute vs 50 for authenticated)
- All access attempts are logged for audit

### Rate Limiting

Each endpoint has specific rate limits to prevent abuse:

| Endpoint | Limit | Purpose |
|----------|-------|---------|
| Initiate Upload | 10/min | Prevent quota abuse |
| Generate Part URL | 100/min | Allow large file uploads |
| Complete Upload | 20/min | Reasonable completion rate |
| Abort Upload | 30/min | Allow cleanup operations |
| Heartbeat | 60/min | Keep uploads alive |
| Delete File | 20/min | Prevent mass deletions |
| Get Signed URL | 50/min | Reasonable access rate |
| Public URL | 30/min | Stricter for unauthenticated |

## Multipart Upload Flow

### 1. Initiate Upload
```typescript
POST /api/storage/multipart/initiate
```
- Validates file type against allowed MIME types
- Checks user storage quota
- Acquires concurrency slot (max concurrent uploads per user)
- Creates file record with PENDING status
- Returns `fileId` and `uploadId`

### 2. Upload Parts
```typescript
POST /api/storage/multipart/:fileId/part/:partNumber/url
```
- Generates presigned URLs for direct upload to storage
- Part numbers: 1-10000
- Minimum part size: 5MB (except last part)
- URLs expire after specified time (default: 1 hour)

### 3. Send Heartbeats (Keep Alive)
```typescript
POST /api/storage/multipart/:fileId/heartbeat
```
- Updates last activity timestamp
- Prevents automatic cleanup of stale uploads
- Should be called every 30-60 seconds during long uploads
- Uploads inactive for 15+ minutes are automatically cleaned

### 4. Complete Upload
```typescript
POST /api/storage/multipart/:fileId/complete
```
- Combines all uploaded parts
- Validates ETags for integrity
- Updates file status to COMPLETED
- Releases concurrency slot
- Updates storage quota

### 5. Abort Upload (Optional)
```typescript
DELETE /api/storage/multipart/:fileId/abort
```
- Cancels upload and cleans up resources
- Deletes all uploaded parts
- Releases concurrency slot
- Restores user quota
- Marks file as ABORTED

## File Operations

### Get File Details
```typescript
GET /api/storage/files/:fileId
```
- Returns file metadata
- Checks access permissions (owner or public)

### List User Files
```typescript
GET /api/storage/files
```
- Returns paginated list of user's files
- Supports filtering by status and path
- Only returns files owned by authenticated user

### Move File
```typescript
PUT /api/storage/files/:fileId/move
```
- Changes virtual folder path
- Only for COMPLETED files
- Updates path in database only (no physical move)

### Rename File
```typescript
PUT /api/storage/files/:fileId/rename
```
- Changes filename
- Validates new filename format
- Only for COMPLETED files

### Set File Visibility
```typescript
PUT /api/storage/files/:fileId/visibility
```
- Toggles between public and private access
- Public files can be accessed without authentication
- Private files require ownership or admin role

### Delete File
```typescript
DELETE /api/storage/files/:fileId
```
- Soft delete by default (marks as DELETED)
- Hard delete with `?hard=true` (admin only)
- Only COMPLETED or ERROR files can be deleted
- Soft-deleted files are purged after 30 days

### Get Signed URL
```typescript
GET /api/storage/files/:fileId/url
```
- Generates time-limited presigned URL
- Private files: Requires authentication and ownership
- Public files: Accessible by anyone
- Default expiration: 1 hour (max: 7 days)

## Quota Management

### Get User Quota
```typescript
GET /api/storage/quota
```
Returns:
- `maxStorage`: Maximum allowed storage in bytes
- `usedStorage`: Current usage in bytes
- `availableStorage`: Remaining space
- `fileCount`: Number of files
- `maxFileSize`: Maximum single file size

## Concurrency Management

### Get Statistics
```typescript
GET /api/storage/concurrency/stats
```
Returns global upload statistics:
- Total active users uploading
- Total active uploads
- Average uploads per user

### Get User Count
```typescript
GET /api/storage/concurrency/user/:userId/count
```
Returns specific user's active upload count

### Clear User Slots (Admin)
```typescript
DELETE /api/storage/concurrency/user/:userId
```
- Admin operation to force-clear stuck uploads
- Use when user reports upload issues
- Requires ROOT or ADMIN role

### Health Check (Admin)
```typescript
GET /api/storage/concurrency/health
```
- Verifies Redis connectivity
- Checks Lua script loading
- Tests basic operations
- Requires ROOT, ROOT_READONLY, or ADMIN role

## Error Handling

All endpoints follow consistent error response format:

```typescript
{
  "statusCode": 400,
  "message": "Error description",
  "error": "BadRequest",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/storage/..."
}
```

Common error codes:
- `400`: Invalid request data
- `403`: Forbidden (insufficient permissions)
- `404`: Resource not found
- `409`: Conflict (e.g., quota exceeded)
- `429`: Too many requests (rate limit)
- `500`: Internal server error

## Audit & Logging

All file operations are intercepted by `FileAuditInterceptor`:
- Logs operation type, user, file ID
- Records success/failure
- Tracks access patterns
- Helps with security monitoring

## Best Practices

### For Frontend Developers

1. **Multipart Upload**:
   - Use for files > 5MB
   - Implement retry logic for part uploads
   - Send heartbeats for uploads > 1 minute
   - Handle network interruptions gracefully

2. **Error Handling**:
   - Implement exponential backoff for retries
   - Show meaningful error messages to users
   - Handle quota exceeded gracefully

3. **Performance**:
   - Cache signed URLs when possible
   - Implement pagination for file lists
   - Use appropriate chunk sizes (5-10MB)

### For Backend Developers

1. **Security**:
   - Always validate file ownership
   - Check permissions before operations
   - Sanitize file paths and names
   - Log all access attempts

2. **Reliability**:
   - Use transactions for multi-step operations
   - Implement proper cleanup on failures
   - Monitor concurrency limits
   - Set appropriate timeouts

3. **Maintenance**:
   - Monitor storage usage trends
   - Clean up abandoned uploads regularly
   - Archive old deleted files
   - Monitor rate limit violations

## Configuration

Key environment variables:

```env
# Storage Provider
STORAGE_DRIVER=minio # or 'aws'
STORAGE_BUCKET=nauto-console-dev

# Limits
MAX_FILE_SIZE=5368709120 # 5GB
MAX_CONCURRENT_UPLOADS=3
UPLOAD_PART_SIZE=5242880 # 5MB

# Cleanup
STALE_UPLOAD_TIMEOUT_MINUTES=15
SOFT_DELETE_RETENTION_DAYS=30

# Rate Limiting
RATE_LIMIT_TTL=60000 # 1 minute
RATE_LIMIT_MAX=100 # Default max requests
```

## Testing

### Unit Tests
- Test each command/query handler in isolation
- Mock external dependencies
- Test business logic and validation

### Integration Tests
- Test complete upload flow
- Test access control scenarios
- Test rate limiting behavior
- Test cleanup mechanisms

### E2E Tests
- Test real multipart upload with MinIO/S3
- Test file operations end-to-end
- Test concurrent upload scenarios
- Test failure recovery

## Monitoring

Key metrics to monitor:
- Upload success/failure rates
- Average upload duration
- Storage usage trends
- Concurrent upload peaks
- Rate limit violations
- Error rates by type
- File access patterns

## Troubleshooting

### Common Issues

1. **"Concurrency limit exceeded"**
   - User has too many active uploads
   - Wait for uploads to complete or abort them
   - Admin can force-clear slots if stuck

2. **"Quota exceeded"**
   - User has reached storage limit
   - Delete unnecessary files
   - Request quota increase

3. **"Upload timeout"**
   - Upload inactive for 15+ minutes
   - Implement heartbeat mechanism
   - Check network stability

4. **"Invalid part number"**
   - Part numbers must be sequential
   - Range: 1-10000
   - Check part upload order

5. **"File not found"**
   - File may be deleted
   - Check file ownership
   - Verify file ID format

## Migration Notes

When migrating from single-file upload to multipart:
1. Update frontend to detect file size
2. Use multipart for files > 5MB
3. Implement progress tracking
4. Add retry logic for failed parts
5. Test with various file sizes
6. Monitor performance impact