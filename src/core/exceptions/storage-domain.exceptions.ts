import { DomainException, ForbiddenActionException } from './domain-exceptions';

// Storage domain exception base class
export abstract class StorageDomainException extends DomainException {}

// File access exceptions - use common forbidden action exception
export class FileAccessDeniedException extends ForbiddenActionException {
  constructor(fileId: string, userId: string) {
    super(`Access denied to file ${fileId} for user ${userId}`, 'access_file', `file:${fileId}`);
  }
}

// Object key exceptions
export class InvalidObjectKeyException extends StorageDomainException {
  constructor(message: string, objectKey?: string) {
    super(message, 'INVALID_OBJECT_KEY', { objectKey });
  }
}

// Storage concurrency exceptions
export class ConcurrencyLimitExceededException extends StorageDomainException {
  constructor(userId: string, currentLimit: number) {
    super(
      `Maximum concurrent uploads reached (${currentLimit}) for user ${userId}`,
      'CONCURRENCY_LIMIT_EXCEEDED',
      { userId, currentLimit },
    );
  }
}

// Storage quota exceptions
export class StorageQuotaExceededException extends StorageDomainException {
  constructor(userId: string, currentUsage: number, attemptedSize: number, maxQuota: number) {
    super(
      `Storage quota exceeded. Current: ${currentUsage} bytes, Attempted: ${attemptedSize} bytes, Max: ${maxQuota} bytes`,
      'STORAGE_QUOTA_EXCEEDED',
      { userId, currentUsage, attemptedSize, maxQuota },
    );
  }
}

// File type exceptions
export class FileTypeNotAllowedException extends StorageDomainException {
  constructor(fileExtension: string, mimeType: string, allowedTypes: string[]) {
    super(
      `File type not allowed. Extension: ${fileExtension}, MIME: ${mimeType}`,
      'FILE_TYPE_NOT_ALLOWED',
      { fileExtension, mimeType, allowedTypes },
    );
  }
}

// Upload exceptions
export class UploadNotFoundException extends StorageDomainException {
  constructor(uploadId: string, fileId?: string) {
    super(`Upload not found with ID: ${uploadId}`, 'UPLOAD_NOT_FOUND', { uploadId, fileId });
  }
}

export class UploadAlreadyCompletedException extends StorageDomainException {
  constructor(fileId: string) {
    super(`Upload for file ${fileId} has already been completed`, 'UPLOAD_ALREADY_COMPLETED', {
      fileId,
    });
  }
}

export class UploadFailedException extends StorageDomainException {
  constructor(fileId: string, reason: string, uploadId?: string) {
    super(`Upload failed for file ${fileId}: ${reason}`, 'UPLOAD_FAILED', {
      fileId,
      reason,
      uploadId,
    });
  }
}

export class InvalidFileStateException extends StorageDomainException {
  constructor(fileId: string, currentState: string, expectedState: string, operation: string) {
    super(
      `Cannot ${operation} file ${fileId}: current state is ${currentState}, expected ${expectedState}`,
      'INVALID_FILE_STATE',
      { fileId, currentState, expectedState, operation },
    );
  }
}

export class InvalidPartNumberException extends StorageDomainException {
  constructor(partNumber: number, maxParts: number = 10000) {
    super(
      `Invalid part number: ${partNumber}. Must be between 1 and ${maxParts}`,
      'INVALID_PART_NUMBER',
      { partNumber, maxParts },
    );
  }
}

// Storage operation exceptions
export class StorageOperationFailedException extends StorageDomainException {
  constructor(operation: string, reason: string, context?: Record<string, unknown>) {
    super(`Storage operation '${operation}' failed: ${reason}`, 'STORAGE_OPERATION_FAILED', {
      operation,
      reason,
      ...context,
    });
  }
}

// Use EntityNotFoundException for objects not found
// Use EntityAlreadyExistsException for objects that already exist

// Folder/path exceptions
export class InvalidPathException extends StorageDomainException {
  constructor(path: string, reason: string) {
    super(`Invalid path '${path}': ${reason}`, 'INVALID_PATH', { path, reason });
  }
}

export class FolderNotEmptyException extends StorageDomainException {
  constructor(path: string, objectCount: number) {
    super(`Cannot delete folder '${path}': contains ${objectCount} objects`, 'FOLDER_NOT_EMPTY', {
      path,
      objectCount,
    });
  }
}

// Storage tier exceptions
export class StorageTierNotFoundException extends StorageDomainException {
  constructor(tierId: string) {
    super(`Storage tier not found: ${tierId}`, 'STORAGE_TIER_NOT_FOUND', { tierId });
  }
}

export class StorageTierNotActiveException extends StorageDomainException {
  constructor(tierId: string, tierName?: string) {
    super(`Storage tier is not active: ${tierName || tierId}`, 'STORAGE_TIER_NOT_ACTIVE', {
      tierId,
      tierName,
    });
  }
}

export class UserStorageConfigNotFoundException extends StorageDomainException {
  constructor(userId: string) {
    super(`No storage configuration found for user: ${userId}`, 'USER_STORAGE_CONFIG_NOT_FOUND', {
      userId,
    });
  }
}
