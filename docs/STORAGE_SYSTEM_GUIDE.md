# Storage System Complete Guide

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Key Features](#key-features)
4. [Setup and Configuration](#setup-and-configuration)
5. [API Endpoints](#api-endpoints)
6. [Testing Guide](#testing-guide)
7. [Common Use Cases](#common-use-cases)
8. [Troubleshooting](#troubleshooting)

## System Overview

The Nauto Console Storage System is an enterprise-grade file management solution built with NestJS, implementing Clean Architecture, CQRS, and Domain-Driven Design principles. It provides secure, scalable multipart file uploads with comprehensive concurrency control, quota management, and access control.

### Core Capabilities
- **Multipart Upload Support**: Handle large files (up to 5TB) with resumable uploads
- **Heartbeat System**: Detect disconnected clients and automatically cleanup stale uploads
- **Concurrency Control**: Redis-based distributed locking and slot management
- **Quota Management**: User-tier based storage quotas with atomic reservations
- **Access Control**: Fine-grained permissions with public/private file support
- **Storage Backends**: MinIO (development) and AWS S3 (production)
- **Event-Driven**: Rich domain events for auditing and notifications
- **Automatic Cleanup**: Background jobs clean expired uploads and release resources

## Architecture

### Clean Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  Controllers (Storage, PublicStorage)                        │
│  Guards, Interceptors, DTOs                                  │
├─────────────────────────────────────────────────────────────┤
│                    Application Layer                         │
│  Commands, Queries, Handlers                                 │
│  Mappers, Response DTOs                                      │
├─────────────────────────────────────────────────────────────┤
│                    Domain/Core Layer                         │
│  Entities (File), Value Objects                              │
│  Domain Services, Repository Interfaces                      │
│  Domain Events, Exceptions                                   │
├─────────────────────────────────────────────────────────────┤
│                   Infrastructure Layer                       │
│  Repository Implementations (Prisma)                         │
│  External Services (MinIO/S3, Redis)                         │
│  Concurrency Service, Transaction Service                    │
└─────────────────────────────────────────────────────────────┘
```

### Component Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Client     │────▶│  Controller  │────▶│   Command    │
└──────────────┘     └──────────────┘     │   Handler    │
                                           └──────────────┘
                                                  │
                            ┌─────────────────────┼─────────────────────┐
                            ▼                     ▼                     ▼
                    ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
                    │  Multipart   │     │    File      │     │    Quota     │
                    │   Service    │     │  Operations  │     │   Service    │
                    └──────────────┘     └──────────────┘     └──────────────┘
                            │                     │                     │
                            ▼                     ▼                     ▼
                    ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
                    │  Concurrency │     │   Storage    │     │    Redis     │
                    │   Service    │     │   (MinIO)    │     │              │
                    └──────────────┘     └──────────────┘     └──────────────┘
```

## Key Features

### 1. Multipart Upload System

The multipart upload system allows uploading large files in chunks with connection monitoring:

- **Initiation**: Creates file record and starts multipart upload
- **Part Upload**: Generates presigned URLs for each part (5MB - 5GB)
- **Heartbeat**: Keeps upload alive and detects disconnected clients
- **Completion**: Combines parts and finalizes upload
- **Abort**: Cancels upload and cleans up resources
- **Auto-Cleanup**: Automatically expires uploads without heartbeat activity

### 2. Concurrency Control

Three-layer locking system prevents race conditions:

1. **File-level locks**: Prevent concurrent operations on same file
2. **User quota locks**: Ensure atomic quota operations
3. **Global concurrency slots**: Limit simultaneous uploads per user

### 3. Quota Management

Reservation-based quota system:

- **Pre-flight validation**: Check quotas before upload
- **Atomic reservations**: Reserve space during upload
- **Automatic cleanup**: TTL-based expiration for abandoned uploads
- **Tier-based limits**: Different quotas per user tier

### 4. Heartbeat & Connection Monitoring

Advanced connection monitoring and automatic cleanup:

- **Client Heartbeat**: Regular signals to keep uploads alive
- **Stale Detection**: Identifies uploads without recent activity
- **Automatic Cleanup**: Background job removes abandoned uploads every 10 minutes
- **Resource Liberation**: Frees concurrency slots and quotas for failed connections
- **Activity Tracking**: Updates file timestamps on heartbeat signals

### 5. Access Control

Permission-based access control:

- **Public files**: Accessible via public endpoint
- **Private files**: Owner-only access
- **Role-based**: Root, admin, user permissions
- **Audit logging**: All operations logged with context

## Setup and Configuration

### Prerequisites

1. **PostgreSQL Database**
2. **Redis Server** (for concurrency control)
3. **MinIO or AWS S3** (for object storage)

### Environment Variables

```bash
# Storage Configuration
STORAGE_DRIVER=minio                    # minio or aws
STORAGE_DEFAULT_BUCKET=nauto-console    # Default bucket name

# MinIO Configuration (Development)
MINIO_ENDPOINT=http://127.0.0.1:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=nauto-console
MINIO_FORCE_PATH_STYLE=true

# AWS S3 Configuration (Production)
AWS_S3_ENDPOINT=                        # Leave empty for standard AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET_NAME=your_bucket
AWS_S3_FORCE_PATH_STYLE=false

# Concurrency Control
GLOBAL_MAX_SIMULTANEOUS_FILES=5         # Max concurrent uploads globally
REDIS_URL=redis://127.0.0.1:6379       # Redis connection
SLOT_TTL_SECONDS=7200                   # Slot expiration (2 hours)
RESERVATION_TTL=7200                    # Quota reservation TTL

# Presigned URLs
PRESIGN_EXPIRY_SEC=3600                 # Default URL expiration
PRESIGN_MAX_EXPIRY_HOURS=24            # Maximum allowed expiration
PRESIGN_MIN_EXPIRY_SECONDS=60          # Minimum allowed expiration

# Heartbeat & Cleanup
STALE_UPLOAD_CLEANUP_INTERVAL=600      # Cleanup job interval (10 minutes)
STALE_UPLOAD_THRESHOLD_MINUTES=15      # Mark uploads as stale after 15 minutes
HEARTBEAT_RATE_LIMIT=60                # Max heartbeats per minute per user
```

### Database Setup

```bash
# Run migrations
npm run db:migrate

# Seed initial data (storage tiers, permissions)
npm run db:seed
```

### MinIO Setup (Development)

```bash
# Using Docker
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  --name minio \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"

# Create bucket
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/nauto-console
```

## API Endpoints

### Multipart Upload Endpoints

#### 1. Initiate Multipart Upload
```http
POST /storage/multipart/initiate
Authorization: Bearer {token}

{
  "path": "/documents",
  "filename": "report.pdf",
  "originalName": "Q4 Report.pdf",
  "mimeType": "application/pdf",
  "size": 104857600,
  "bucket": "nauto-console"
}

Response:
{
  "fileId": "uuid",
  "uploadId": "upload-id",
  "partSize": 5242880,
  "totalParts": 20
}
```

#### 2. Generate Part URL
```http
POST /storage/multipart/{fileId}/part/{partNumber}/url
Authorization: Bearer {token}

Response:
{
  "url": "https://...",
  "expirationSeconds": 3600
}
```

#### 3. Complete Upload
```http
POST /storage/multipart/{fileId}/complete
Authorization: Bearer {token}

{
  "parts": [
    { "partNumber": 1, "etag": "etag1" },
    { "partNumber": 2, "etag": "etag2" }
  ]
}
```

#### 4. Send Heartbeat (Keep Upload Alive)
```http
POST /storage/multipart/{fileId}/heartbeat
Authorization: Bearer {token}

Response: 204 No Content
```

#### 5. Abort Upload
```http
DELETE /storage/multipart/{fileId}/abort
Authorization: Bearer {token}
```

### File Operations Endpoints

#### Get File Details
```http
GET /storage/files/{fileId}
Authorization: Bearer {token}
```

#### List User Files
```http
GET /storage/files?status=uploaded&path=/documents&limit=20&offset=0
Authorization: Bearer {token}
```

#### Move File
```http
PUT /storage/files/{fileId}/move
Authorization: Bearer {token}

{
  "newPath": "/archive/2024"
}
```

#### Rename File
```http
PUT /storage/files/{fileId}/rename
Authorization: Bearer {token}

{
  "newFilename": "updated-report.pdf"
}
```

#### Set File Visibility
```http
PUT /storage/files/{fileId}/visibility
Authorization: Bearer {token}

{
  "isPublic": true
}
```

#### Delete File
```http
DELETE /storage/files/{fileId}?hard=false
Authorization: Bearer {token}
```

#### Get Signed URL
```http
GET /storage/files/{fileId}/url?expirationSeconds=3600
Authorization: Bearer {token}
```

### Public Endpoints

#### Get Public File URL (No Auth Required)
```http
GET /public/storage/files/{fileId}/url?expirationSeconds=3600
```

### Management Endpoints

#### Get Storage Quota
```http
GET /storage/quota
Authorization: Bearer {token}

Response:
{
  "currentUsage": 524288000,
  "maxQuota": 1073741824,
  "availableSpace": 549453824,
  "filesCount": 42,
  "maxFiles": 100
}
```

#### Get Concurrency Stats (Admin)
```http
GET /storage/concurrency/stats
Authorization: Bearer {token}
```

## Testing Guide

### Unit Testing

```bash
# Run all unit tests
npm run test

# Test specific service
npm run test file-operations.service.spec.ts

# Test with coverage
npm run test:cov
```

### Integration Testing

#### 1. Test Multipart Upload Flow

```javascript
// test-multipart-upload.js
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');

async function testMultipartUpload() {
  const API_URL = 'http://localhost:3010';
  const token = 'your-jwt-token';
  
  // 1. Initiate upload
  const initResponse = await axios.post(
    `${API_URL}/storage/multipart/initiate`,
    {
      path: '/test',
      filename: 'test-file.bin',
      originalName: 'Test File.bin',
      mimeType: 'application/octet-stream',
      size: 10485760 // 10MB
    },
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  const { fileId, uploadId, partSize, totalParts } = initResponse.data;
  console.log(`Upload initiated: ${fileId}`);
  
  // 2. Upload parts
  const fileContent = crypto.randomBytes(10485760);
  const parts = [];
  
  for (let i = 1; i <= totalParts; i++) {
    // Get presigned URL
    const urlResponse = await axios.post(
      `${API_URL}/storage/multipart/${fileId}/part/${i}/url`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    // Upload part to presigned URL
    const start = (i - 1) * partSize;
    const end = Math.min(i * partSize, fileContent.length);
    const partData = fileContent.slice(start, end);
    
    const uploadResponse = await axios.put(
      urlResponse.data.url,
      partData,
      {
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      }
    );
    
    parts.push({
      partNumber: i,
      etag: uploadResponse.headers.etag.replace(/"/g, '')
    });
    
    console.log(`Part ${i}/${totalParts} uploaded`);
  }
  
  // 3. Complete upload
  await axios.post(
    `${API_URL}/storage/multipart/${fileId}/complete`,
    { parts },
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  console.log('Upload completed successfully!');
  
  // 4. Get signed URL
  const urlResponse = await axios.get(
    `${API_URL}/storage/files/${fileId}/url`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  console.log('Signed URL:', urlResponse.data.url);
}

testMultipartUpload().catch(console.error);
```

#### 2. Test Quota Enforcement

```javascript
async function testQuotaEnforcement() {
  const API_URL = 'http://localhost:3010';
  const token = 'your-jwt-token';
  
  // Check current quota
  const quotaResponse = await axios.get(
    `${API_URL}/storage/quota`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  console.log('Current quota:', quotaResponse.data);
  
  // Try to upload file exceeding available space
  try {
    await axios.post(
      `${API_URL}/storage/multipart/initiate`,
      {
        path: '/test',
        filename: 'large-file.bin',
        originalName: 'Large File.bin',
        mimeType: 'application/octet-stream',
        size: quotaResponse.data.availableSpace + 1
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
  } catch (error) {
    console.log('Expected error:', error.response.data.message);
  }
}
```

#### 3. Test Concurrency Limits

```javascript
async function testConcurrencyLimits() {
  const API_URL = 'http://localhost:3010';
  const token = 'your-jwt-token';
  
  const uploads = [];
  
  // Try to initiate multiple uploads
  for (let i = 1; i <= 10; i++) {
    const promise = axios.post(
      `${API_URL}/storage/multipart/initiate`,
      {
        path: '/test',
        filename: `file-${i}.bin`,
        originalName: `File ${i}.bin`,
        mimeType: 'application/octet-stream',
        size: 1048576 // 1MB
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    ).then(res => ({ success: true, fileId: res.data.fileId }))
      .catch(err => ({ success: false, error: err.response?.data?.message }));
    
    uploads.push(promise);
  }
  
  const results = await Promise.all(uploads);
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`Successful: ${successful}, Failed: ${failed}`);
  console.log('Should match GLOBAL_MAX_SIMULTANEOUS_FILES setting');
}
```

### Manual Testing with cURL

#### Upload Small File
```bash
# 1. Get JWT token
TOKEN=$(curl -X POST http://localhost:3010/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  | jq -r '.accessToken')

# 2. Initiate upload
RESPONSE=$(curl -X POST http://localhost:3010/storage/multipart/initiate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/test",
    "filename": "test.txt",
    "originalName": "test.txt",
    "mimeType": "text/plain",
    "size": 100
  }')

FILE_ID=$(echo $RESPONSE | jq -r '.fileId')

# 3. Get presigned URL
URL_RESPONSE=$(curl -X POST "http://localhost:3010/storage/multipart/$FILE_ID/part/1/url" \
  -H "Authorization: Bearer $TOKEN")

UPLOAD_URL=$(echo $URL_RESPONSE | jq -r '.url')

# 4. Upload content
ETAG=$(curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: text/plain" \
  -d "Test file content" \
  -i | grep -i etag | cut -d' ' -f2 | tr -d '\r"')

# 5. Complete upload
curl -X POST "http://localhost:3010/storage/multipart/$FILE_ID/complete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"parts\": [{\"partNumber\": 1, \"etag\": \"$ETAG\"}]}"

# 6. Get download URL
curl -X GET "http://localhost:3010/storage/files/$FILE_ID/url" \
  -H "Authorization: Bearer $TOKEN"
```

## Common Use Cases

### 1. Profile Picture Upload

```javascript
async function uploadProfilePicture(file) {
  // Validate file
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Profile picture must be less than 5MB');
  }
  
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    throw new Error('Only JPEG and PNG images are allowed');
  }
  
  // Single part upload for small files
  const initResponse = await api.post('/storage/multipart/initiate', {
    path: '/profile',
    filename: `avatar.${file.name.split('.').pop()}`,
    originalName: file.name,
    mimeType: file.type,
    size: file.size
  });
  
  // Upload directly
  const urlResponse = await api.post(
    `/storage/multipart/${initResponse.data.fileId}/part/1/url`
  );
  
  await axios.put(urlResponse.data.url, file);
  
  // Complete
  await api.post(`/storage/multipart/${initResponse.data.fileId}/complete`, {
    parts: [{ partNumber: 1, etag: 'etag-from-response' }]
  });
  
  return initResponse.data.fileId;
}
```

### 2. Large Report Upload with Progress

```javascript
class LargeFileUploader {
  constructor(apiClient) {
    this.api = apiClient;
    this.onProgress = null;
    this.heartbeatInterval = null;
  }
  
  async upload(file, onProgress) {
    this.onProgress = onProgress;
    
    // Initiate
    const { fileId, partSize, totalParts } = await this.initiate(file);
    
    // Start heartbeat to keep upload alive
    this.startHeartbeat(fileId);
    
    try {
      // Upload parts
      const parts = await this.uploadParts(file, fileId, partSize, totalParts);
      
      // Complete
      await this.complete(fileId, parts);
      
      return fileId;
    } finally {
      // Always stop heartbeat
      this.stopHeartbeat();
    }
  }
  
  startHeartbeat(fileId) {
    // Send heartbeat every 30 seconds to keep upload alive
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.api.post(`/storage/multipart/${fileId}/heartbeat`);
      } catch (error) {
        console.warn('Heartbeat failed:', error.message);
      }
    }, 30000); // 30 seconds
  }
  
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  async initiate(file) {
    const response = await this.api.post('/storage/multipart/initiate', {
      path: '/reports',
      filename: file.name,
      originalName: file.name,
      mimeType: file.type,
      size: file.size
    });
    
    return response.data;
  }
  
  async uploadParts(file, fileId, partSize, totalParts) {
    const parts = [];
    
    for (let i = 1; i <= totalParts; i++) {
      // Get URL
      const urlResponse = await this.api.post(
        `/storage/multipart/${fileId}/part/${i}/url`
      );
      
      // Slice file
      const start = (i - 1) * partSize;
      const end = Math.min(i * partSize, file.size);
      const blob = file.slice(start, end);
      
      // Upload with progress
      const etag = await this.uploadPart(urlResponse.data.url, blob);
      parts.push({ partNumber: i, etag });
      
      // Report progress
      if (this.onProgress) {
        this.onProgress({
          loaded: end,
          total: file.size,
          percentage: Math.round((end / file.size) * 100)
        });
      }
    }
    
    return parts;
  }
  
  async uploadPart(url, blob) {
    const response = await axios.put(url, blob, {
      headers: { 'Content-Type': 'application/octet-stream' },
      onUploadProgress: (progressEvent) => {
        // Part-level progress if needed
      }
    });
    
    return response.headers.etag.replace(/"/g, '');
  }
  
  async complete(fileId, parts) {
    await this.api.post(`/storage/multipart/${fileId}/complete`, { parts });
  }
}
```

### 3. Public File Sharing

```javascript
async function shareFilePublicly(fileId) {
  // Make file public
  await api.put(`/storage/files/${fileId}/visibility`, {
    isPublic: true
  });
  
  // Get public URL (no auth required)
  const response = await axios.get(
    `/public/storage/files/${fileId}/url?expirationSeconds=86400`
  );
  
  return response.data.url;
}
```

### 4. Batch File Operations

```javascript
async function organizeFilesByDate(userId) {
  // Get all user files
  const files = await api.get('/storage/files?limit=1000');
  
  // Group by year/month
  const operations = files.data.files.map(file => {
    const date = new Date(file.createdAt);
    const newPath = `/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    return api.put(`/storage/files/${file.id}/move`, { newPath });
  });
  
  // Execute in batches to avoid overwhelming the server
  const batchSize = 10;
  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize);
    await Promise.all(batch);
    console.log(`Processed ${i + batch.length}/${operations.length} files`);
  }
}
```

## Troubleshooting

### Common Issues and Solutions

#### 1. "Concurrency limit exceeded"
**Problem**: Too many simultaneous uploads
**Solution**: 
- Wait for ongoing uploads to complete
- Increase `GLOBAL_MAX_SIMULTANEOUS_FILES` if needed
- Clear stuck slots: `DELETE /storage/concurrency/user/{userId}`

#### 2. "Quota exceeded"
**Problem**: User has reached storage limit
**Solution**:
- Check quota: `GET /storage/quota`
- Delete unnecessary files
- Upgrade user tier for more storage

#### 3. "Upload timeout"
**Problem**: Part URLs expired
**Solution**:
- Increase `PRESIGN_EXPIRY_SEC` for slow connections
- Implement retry logic in client
- Use smaller part sizes for unstable connections

#### 4. "Invalid file type"
**Problem**: MIME type not allowed
**Solution**:
- Check user's allowed file types in storage config
- Update `DEFAULT_ALLOWED_FILE_CONFIG` environment variable
- Use correct MIME type in request

#### 5. Redis Connection Issues
**Problem**: "Could not acquire lock" or "Concurrency service unavailable"
**Solution**:
```bash
# Check Redis connection
redis-cli ping

# Check Redis memory
redis-cli INFO memory

# Clear all upload slots (emergency)
redis-cli --scan --pattern "{uploads}:*" | xargs redis-cli DEL
```

#### 6. MinIO/S3 Issues
**Problem**: "Storage service error"
**Solution**:
```bash
# Check MinIO health
curl http://localhost:9000/minio/health/live

# Verify bucket exists
mc ls local/nauto-console

# Check credentials
echo $MINIO_ACCESS_KEY
echo $MINIO_SECRET_KEY
```

#### 7. Upload Automatically Cancelled
**Problem**: Uploads fail with "Upload not found" after period of inactivity
**Solution**:
- Ensure client sends heartbeat every 30 seconds during upload
- Check if `STALE_UPLOAD_THRESHOLD_MINUTES` is appropriate for your use case
- Verify network stability - heartbeat failures can cause early cleanup
- Check background cleanup job is running: `GET /storage/concurrency/health`

#### 8. Heartbeat Rate Limit
**Problem**: "Too Many Requests" on heartbeat endpoint
**Solution**:
- Reduce heartbeat frequency (recommended: 30-60 seconds)
- Check `HEARTBEAT_RATE_LIMIT` configuration (default: 60/minute)
- Ensure client stops heartbeat after upload completion/failure

### Debug Mode

Enable detailed logging:

```bash
# Set log level
LOG_LEVEL=debug npm run start:dev

# Enable Prisma logs
PRISMA_LOGS_ENABLED=true npm run start:dev
```

### Performance Optimization

#### 1. Optimize Part Size
```javascript
function calculateOptimalPartSize(fileSize) {
  const MIN_PART_SIZE = 5 * 1024 * 1024;    // 5MB
  const MAX_PART_SIZE = 100 * 1024 * 1024;  // 100MB
  const MAX_PARTS = 10000;
  
  let partSize = Math.ceil(fileSize / MAX_PARTS);
  partSize = Math.max(partSize, MIN_PART_SIZE);
  partSize = Math.min(partSize, MAX_PART_SIZE);
  
  return partSize;
}
```

#### 2. Parallel Part Uploads
```javascript
async function uploadPartsInParallel(parts, concurrency = 3) {
  const results = [];
  const executing = [];
  
  for (const part of parts) {
    const promise = uploadPart(part).then(result => {
      executing.splice(executing.indexOf(promise), 1);
      return result;
    });
    
    results.push(promise);
    executing.push(promise);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  
  return Promise.all(results);
}
```

#### 3. Connection Pooling
```bash
# Database
DATABASE_CONNECTION_LIMIT=50

# Redis connection reuse is automatic
```

## Monitoring and Maintenance

### Health Checks

```bash
# Storage system health
curl http://localhost:3010/health/storage

# Concurrency service health
curl http://localhost:3010/storage/concurrency/health

# Overall system health
curl http://localhost:3010/health
```

### Metrics to Monitor

1. **Upload Success Rate**: Track completed vs failed uploads
2. **Average Upload Time**: Monitor performance degradation
3. **Quota Usage**: Alert when users approach limits
4. **Concurrent Uploads**: Track peak usage patterns
5. **Storage Backend Latency**: Monitor S3/MinIO response times

### Maintenance Tasks

#### Daily
- Monitor error logs for failed uploads
- Check Redis memory usage
- Verify backup completion

#### Weekly
- Clean up orphaned multipart uploads
- Review storage usage trends
- Analyze performance metrics

#### Monthly
- Audit file access logs
- Review and adjust quotas
- Update allowed file types if needed

### Cleanup Script

```javascript
// cleanup-orphaned-uploads.js
async function cleanupOrphanedUploads() {
  // Find uploads older than 24 hours in 'uploading' state
  const orphanedFiles = await db.file.findMany({
    where: {
      status: 'uploading',
      updatedAt: {
        lt: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    }
  });
  
  for (const file of orphanedFiles) {
    try {
      // Abort multipart upload in storage
      await storageService.abortMultipartUpload(
        file.bucket,
        file.objectKey,
        file.uploadId
      );
      
      // Mark as failed in database
      await db.file.update({
        where: { id: file.id },
        data: { status: 'failed' }
      });
      
      console.log(`Cleaned up orphaned upload: ${file.id}`);
    } catch (error) {
      console.error(`Failed to cleanup ${file.id}:`, error);
    }
  }
}
```

## Security Considerations

### 1. Path Traversal Prevention
- ObjectKey value object validates against `../` patterns
- Sanitization of user-provided paths

### 2. MIME Type Validation
- Whitelist approach for allowed types
- Server-side validation independent of client

### 3. Access Control
- JWT-based authentication
- Role and permission checks
- Audit logging for all operations

### 4. Rate Limiting
- Throttling on all endpoints
- Stricter limits for public endpoints
- Per-user concurrency limits

### 5. Secure URLs
- Time-limited presigned URLs
- HTTPS enforcement in production
- URL signature validation

## Conclusion

The Nauto Console Storage System provides a robust, scalable solution for file management with enterprise-grade features. Its Clean Architecture design ensures maintainability, while comprehensive testing and monitoring capabilities ensure reliability in production environments.

For additional support or questions, please refer to the main project documentation or contact the development team.