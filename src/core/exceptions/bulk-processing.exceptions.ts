import { DomainException } from './domain-exceptions';

export abstract class BulkProcessingDomainException extends DomainException {}

export class BulkProcessingRequestNotFoundException extends BulkProcessingDomainException {
  constructor(requestId: string) {
    super(
      `Bulk processing request with id ${requestId} not found`,
      'BULK_PROCESSING_REQUEST_NOT_FOUND',
      { requestId },
    );
  }
}

export class BulkProcessingInsufficientPermissionsException extends BulkProcessingDomainException {
  constructor(requiredPermission: string, resource?: string) {
    super(
      `Insufficient permissions: ${requiredPermission} required`,
      'BULK_PROCESSING_INSUFFICIENT_PERMISSIONS',
      {
        requiredPermission,
        resource,
      },
    );
  }
}

export class UnauthorizedBulkProcessingRequestAccessException extends BulkProcessingDomainException {
  constructor(requestId?: string, companyId?: string) {
    const context =
      requestId && companyId
        ? `request ${requestId} in company ${companyId}`
        : 'bulk processing request';
    super(`Unauthorized access to ${context}`, 'UNAUTHORIZED_BULK_PROCESSING_REQUEST_ACCESS', {
      requestId,
      companyId,
    });
  }
}

export class InvalidBulkProcessingFileException extends BulkProcessingDomainException {
  constructor(fileName: string, reason: string) {
    super(`Invalid bulk processing file '${fileName}': ${reason}`, 'INVALID_BULK_PROCESSING_FILE', {
      fileName,
      reason,
    });
  }
}

export class BulkProcessingFileDownloadException extends BulkProcessingDomainException {
  constructor(url: string, error: string) {
    super(
      `Failed to download file from '${url}': ${error}`,
      'BULK_PROCESSING_FILE_DOWNLOAD_FAILED',
      { url, error },
    );
  }
}

export class BulkProcessingRowValidationException extends BulkProcessingDomainException {
  constructor(rowNumber: number, fieldName: string, value: unknown, reason: string) {
    super(
      `Validation error on row ${rowNumber}, field '${fieldName}' with value '${value}': ${reason}`,
      'BULK_PROCESSING_ROW_VALIDATION_ERROR',
      { rowNumber, fieldName, value, reason },
    );
  }
}

export class BulkProcessingS3StorageException extends BulkProcessingDomainException {
  constructor(operation: string, key: string, error: string) {
    super(
      `S3 storage operation '${operation}' failed for key '${key}': ${error}`,
      'BULK_PROCESSING_S3_STORAGE_ERROR',
      { operation, key, error },
    );
  }
}

export class BulkProcessingExcelParsingException extends BulkProcessingDomainException {
  constructor(fileName: string, error: string) {
    super(
      `Failed to parse Excel file '${fileName}': ${error}`,
      'BULK_PROCESSING_EXCEL_PARSING_ERROR',
      { fileName, error },
    );
  }
}

export class BulkProcessingFileStatusRestoreException extends BulkProcessingDomainException {
  constructor(requestId: string, fileId: string, originalStatus: string) {
    super(
      `Failed to restore file status for cancelled bulk processing request ${requestId}. File ${fileId} may remain in processing state and require manual intervention`,
      'BULK_PROCESSING_FILE_STATUS_RESTORE_FAILED',
      { requestId, fileId, originalStatus },
    );
  }
}

export class BulkProcessingInvalidStatusException extends BulkProcessingDomainException {
  constructor(requestId: string, currentStatus: string, action: string) {
    super(
      `Bulk processing request ${requestId} cannot be ${action} (current status: ${currentStatus})`,
      'BULK_PROCESSING_INVALID_STATUS',
      { requestId, currentStatus, action },
    );
  }
}

export class BulkProcessingFileNotFoundException extends BulkProcessingDomainException {
  constructor(requestId: string, fileId: string) {
    super(
      `File ${fileId} not found for bulk processing request ${requestId}`,
      'BULK_PROCESSING_FILE_NOT_FOUND',
      { requestId, fileId },
    );
  }
}

export class BulkProcessingInvalidFileStatusException extends BulkProcessingDomainException {
  constructor(fileId: string, currentStatus: string, requiredStatus: string) {
    super(
      `File ${fileId} must be in ${requiredStatus} status to start bulk processing. Current status: ${currentStatus}`,
      'BULK_PROCESSING_INVALID_FILE_STATUS',
      { fileId, currentStatus, requiredStatus },
    );
  }
}

export class BulkProcessingNoErrorsFoundException extends BulkProcessingDomainException {
  constructor(requestId: string) {
    super(
      `No errors found in bulk processing request ${requestId}. Error report cannot be generated`,
      'BULK_PROCESSING_NO_ERRORS_FOUND',
      { requestId },
    );
  }
}
