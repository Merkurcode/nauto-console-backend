/* eslint-disable @typescript-eslint/no-explicit-any */
import { DomainEvent } from './domain-event.base';
import { BulkProcessingRequestId } from '@core/value-objects/bulk-processing-request-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { FileId } from '@core/value-objects/file-id.vo';
import { BulkProcessingType } from '@shared/constants/bulk-processing-type.enum';

export class BulkProcessingRequestCreatedEvent extends DomainEvent {
  constructor(
    public readonly requestId: BulkProcessingRequestId,
    public readonly type: BulkProcessingType,
    public readonly fileId: FileId,
    public readonly fileName: string,
    public readonly companyId: CompanyId,
    public readonly requestedBy: UserId,
  ) {
    super();
  }

  getEventName(): string {
    return 'bulk_processing_request.created';
  }
}

export class BulkProcessingRequestStartedEvent extends DomainEvent {
  constructor(
    public readonly requestId: BulkProcessingRequestId,
    public readonly type: BulkProcessingType,
    public readonly companyId: CompanyId,
    public readonly requestedBy: UserId,
    public readonly totalRows: number,
  ) {
    super();
  }

  getEventName(): string {
    return 'bulk_processing_request.started';
  }
}

export class BulkProcessingRowProcessedEvent extends DomainEvent {
  constructor(
    public readonly requestId: BulkProcessingRequestId,
    public readonly type: BulkProcessingType,
    public readonly companyId: CompanyId,
    public readonly requestedBy: UserId,
    public readonly rowNumber: number,
    public readonly entityId: string | undefined,
    public readonly success: boolean,
    public readonly entityType?: string,
    public readonly metadata?: Record<string, any>,
  ) {
    super();
  }

  getEventName(): string {
    return 'bulk_processing_request.row_processed';
  }
}

export class BulkProcessingRequestCompletedEvent extends DomainEvent {
  constructor(
    public readonly requestId: BulkProcessingRequestId,
    public readonly type: BulkProcessingType,
    public readonly companyId: CompanyId,
    public readonly requestedBy: UserId,
    public readonly processedRows: number,
    public readonly successfulRows: number,
    public readonly failedRows: number,
    public readonly initialRows: number,
    public readonly finalRows: number,
  ) {
    super();
  }

  getEventName(): string {
    return 'bulk_processing_request.completed';
  }
}

export class BulkProcessingRequestFailedEvent extends DomainEvent {
  constructor(
    public readonly requestId: BulkProcessingRequestId,
    public readonly type: BulkProcessingType,
    public readonly companyId: CompanyId,
    public readonly requestedBy: UserId,
    public readonly errorMessage: string,
    public readonly processedRows: number,
    public readonly successfulRows: number,
    public readonly failedRows: number,
  ) {
    super();
  }

  getEventName(): string {
    return 'bulk_processing_request.failed';
  }
}

export class BulkProcessingRequestCancellationStartedEvent extends DomainEvent {
  constructor(
    public readonly requestId: BulkProcessingRequestId,
    public readonly type: BulkProcessingType,
    public readonly companyId: CompanyId,
    public readonly requestedBy: UserId,
    public readonly processedRows: number,
    public readonly successfulRows: number,
    public readonly failedRows: number,
  ) {
    super();
  }

  getEventName(): string {
    return 'bulk_processing_request.cancellation_started';
  }
}

export class BulkProcessingRequestCancelledEvent extends DomainEvent {
  constructor(
    public readonly requestId: BulkProcessingRequestId,
    public readonly type: BulkProcessingType,
    public readonly companyId: CompanyId,
    public readonly requestedBy: UserId,
    public readonly processedRows: number,
    public readonly successfulRows: number,
    public readonly failedRows: number,
  ) {
    super();
  }

  getEventName(): string {
    return 'bulk_processing_request.cancelled';
  }
}
