/* eslint-disable @typescript-eslint/no-explicit-any */
import { AggregateRoot } from '@core/events/domain-event.base';
import { BulkProcessingRequestId } from '@core/value-objects/bulk-processing-request-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { FileId } from '@core/value-objects/file-id.vo';
import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';
import {
  BulkProcessingRequestCreatedEvent,
  BulkProcessingRequestStartedEvent,
  BulkProcessingRequestCompletedEvent,
  BulkProcessingRequestFailedEvent,
  BulkProcessingRowProcessedEvent,
  BulkProcessingRequestCancellationStartedEvent,
  BulkProcessingRequestCancelledEvent,
} from '@core/events/bulk-processing-request.events';
import { BulkProcessingStatus } from '@shared/constants/bulk-processing-status.enum';
import { BulkProcessingType } from '@shared/constants/bulk-processing-type.enum';

export interface IBulkProcessingRowLog {
  rowNumber: number;
  entityId?: string; // Generic entity ID (could be productId, userId, etc.)
  entityType?: string; // Type of entity being processed
  errors: string[];
  warnings: string[];
  metadata?: Record<string, any>; // Additional metadata for the row
  processedAt: Date;
}

export class BulkProcessingRequest extends AggregateRoot {
  private readonly _id: BulkProcessingRequestId;
  private readonly _type: BulkProcessingType;
  private readonly _fileId: FileId;
  private readonly _fileName: string;
  private _status: BulkProcessingStatus;
  private _jobId: string | null;
  private _totalRows: number | null;
  private _processedRows: number;
  private _successfulRows: number;
  private _failedRows: number;
  private _rowLogs: IBulkProcessingRowLog[];
  private _errorMessage: string | null;
  private _startedAt: Date | null;
  private _completedAt: Date | null;
  private _excelProcessingCompleted: boolean;
  private _metadata: Record<string, any>;
  private readonly _companyId: CompanyId;
  private readonly _requestedBy: UserId;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(
    id: BulkProcessingRequestId,
    type: BulkProcessingType,
    fileId: FileId,
    fileName: string,
    companyId: CompanyId,
    requestedBy: UserId,
    status?: BulkProcessingStatus,
    jobId?: string | null,
    totalRows?: number | null,
    processedRows?: number,
    successfulRows?: number,
    failedRows?: number,
    rowLogs?: IBulkProcessingRowLog[],
    errorMessage?: string | null,
    startedAt?: Date | null,
    completedAt?: Date | null,
    excelProcessingCompleted?: boolean,
    metadata?: Record<string, any>,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super();
    this._id = id;
    this._type = type;
    this._fileId = fileId;
    this._fileName = fileName;
    this._companyId = companyId;
    this._requestedBy = requestedBy;
    this._status = status || BulkProcessingStatus.PENDING;
    this._jobId = jobId || null;
    this._totalRows = totalRows || null;
    this._processedRows = processedRows || 0;
    this._successfulRows = successfulRows || 0;
    this._failedRows = failedRows || 0;
    this._rowLogs = rowLogs || [];
    this._errorMessage = errorMessage || null;
    this._startedAt = startedAt || null;
    this._completedAt = completedAt || null;
    this._excelProcessingCompleted = excelProcessingCompleted || false;
    this._metadata = metadata || {};
    this._createdAt = createdAt || new Date();
    this._updatedAt = updatedAt || new Date();

    this.validateType();
    this.validateFileName();
  }

  static create(data: {
    type: BulkProcessingType;
    fileId: string;
    fileName: string;
    companyId: string;
    requestedBy: string;
  }): BulkProcessingRequest {
    const id = BulkProcessingRequestId.create(crypto.randomUUID());
    const fileId = FileId.fromString(data.fileId);
    const companyId = CompanyId.fromString(data.companyId);
    const requestedBy = UserId.fromString(data.requestedBy);

    const request = new BulkProcessingRequest(
      id,
      data.type,
      fileId,
      data.fileName,
      companyId,
      requestedBy,
    );

    request.addDomainEvent(
      new BulkProcessingRequestCreatedEvent(
        id,
        data.type,
        fileId,
        data.fileName,
        companyId,
        requestedBy,
      ),
    );

    return request;
  }

  static fromData(data: {
    id: string;
    type: BulkProcessingType;
    fileId: string;
    fileName: string;
    status: BulkProcessingStatus;
    jobId: string | null;
    totalRows: number | null;
    processedRows: number;
    successfulRows: number;
    failedRows: number;
    rowLogs: IBulkProcessingRowLog[];
    errorMessage: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    excelProcessingCompleted: boolean;
    metadata?: Record<string, any>;
    companyId: string;
    requestedBy: string;
    createdAt: Date;
    updatedAt: Date;
  }): BulkProcessingRequest {
    const id = BulkProcessingRequestId.create(data.id);
    const fileId = FileId.fromString(data.fileId);
    const companyId = CompanyId.fromString(data.companyId);
    const requestedBy = UserId.fromString(data.requestedBy);

    return new BulkProcessingRequest(
      id,
      data.type,
      fileId,
      data.fileName,
      companyId,
      requestedBy,
      data.status,
      data.jobId,
      data.totalRows,
      data.processedRows,
      data.successfulRows,
      data.failedRows,
      data.rowLogs,
      data.errorMessage,
      data.startedAt,
      data.completedAt,
      data.excelProcessingCompleted,
      data.metadata,
      data.createdAt,
      data.updatedAt,
    );
  }

  private validateType(): void {
    const validTypes = Object.values(BulkProcessingType);
    if (!validTypes.includes(this._type)) {
      throw new InvalidValueObjectException(`Invalid bulk processing type: ${this._type}`);
    }
  }

  private validateFileName(): void {
    if (!this._fileName || this._fileName.trim().length === 0) {
      throw new InvalidValueObjectException('File name cannot be empty');
    }
  }

  // Getters
  get id(): BulkProcessingRequestId {
    return this._id;
  }

  get type(): BulkProcessingType {
    return this._type;
  }

  get fileId(): FileId {
    return this._fileId;
  }

  get fileName(): string {
    return this._fileName;
  }

  get status(): BulkProcessingStatus {
    return this._status;
  }

  get jobId(): string | null {
    return this._jobId;
  }

  get totalRows(): number | null {
    return this._totalRows;
  }

  get processedRows(): number {
    return this._processedRows;
  }

  get successfulRows(): number {
    return this._successfulRows;
  }

  get failedRows(): number {
    return this._failedRows;
  }

  get rowLogs(): IBulkProcessingRowLog[] {
    return [...this._rowLogs]; // Return copy to prevent direct mutation
  }

  get errorMessage(): string | null {
    return this._errorMessage;
  }

  get startedAt(): Date | null {
    return this._startedAt;
  }

  get completedAt(): Date | null {
    return this._completedAt;
  }

  get excelProcessingCompleted(): boolean {
    return this._excelProcessingCompleted;
  }

  get metadata(): Record<string, any> {
    return { ...this._metadata }; // Return copy to prevent direct mutation
  }

  get companyId(): CompanyId {
    return this._companyId;
  }

  get requestedBy(): UserId {
    return this._requestedBy;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get progressPercentage(): number {
    if (!this._totalRows || this._totalRows === 0) {
      return 0;
    }

    return Math.round((this._processedRows / this._totalRows) * 100);
  }

  // Setter for totalRows - needed for fixing sync issues during multimedia processing
  setTotalRows(totalRows: number): void {
    this._totalRows = totalRows;
    this._updatedAt = new Date();
  }

  // Business methods
  public static generateReport(logs: IBulkProcessingRowLog[]): string {
    if (!logs || logs.length === 0) {
      return 'No logs found in processing.';
    }

    // Generate CSV UTF-8 format
    const headers = [
      'Row Number',
      'Entity ID',
      'Entity Type',
      'Errors',
      'Warnings',
      'Metadata',
      'Processed At',
    ];
    const csvRows = [headers.join(',')];

    for (const log of logs) {
      const row = [
        log.rowNumber.toString(),
        log.entityId || '',
        log.entityType || '',
        `"${log.errors.join('; ')}"`,
        `"${log.warnings.join('; ')}"`,
        `"${log.metadata ? JSON.stringify(log.metadata).replace(/"/g, '""') : ''}"`,
        log.processedAt ? new Date(log.processedAt).toISOString() : '-',
      ];
      csvRows.push(row.join(','));
    }

    // Add UTF-8 BOM for proper Excel encoding
    return '\uFEFF' + csvRows.join('\n');
  }

  setJobId(jobId: string): void {
    this._jobId = jobId || null;
    this._updatedAt = new Date();
  }

  start(totalRows: number): void {
    if (this._status !== BulkProcessingStatus.PENDING) {
      throw new InvalidValueObjectException(
        `Cannot start bulk processing request with status: ${this._status}`,
      );
    }

    this._status = BulkProcessingStatus.PROCESSING;
    this._totalRows = totalRows;
    this._startedAt = new Date();
    this._updatedAt = new Date();

    this.addDomainEvent(
      new BulkProcessingRequestStartedEvent(
        this._id,
        this._type,
        this._companyId,
        this._requestedBy,
        totalRows,
      ),
    );
  }

  addRowLog(rowLog: IBulkProcessingRowLog): void {
    if (this._status !== BulkProcessingStatus.PROCESSING) {
      throw new InvalidValueObjectException(
        `Cannot add row log to bulk processing request with status: ${this._status}`,
      );
    }

    // Only add to logs if there are errors or warnings (for storage efficiency)
    if (rowLog.errors.length > 0 || rowLog.warnings.length > 0) {
      this._rowLogs.push(rowLog);
    }

    this._processedRows++;

    if (rowLog.errors.length > 0) {
      this._failedRows++;
    } else {
      this._successfulRows++;
    }

    this._updatedAt = new Date();
  }

  // Method specifically for multimedia warnings that don't affect row counters
  addMultimediaWarning(rowLog: IBulkProcessingRowLog): void {
    if (this._status !== BulkProcessingStatus.PROCESSING) {
      throw new InvalidValueObjectException(
        `Cannot add multimedia warning to bulk processing request with status: ${this._status}`,
      );
    }

    // Only add to logs if there are errors or warnings (for storage efficiency)
    if (rowLog.errors.length > 0 || rowLog.warnings.length > 0) {
      this._rowLogs.push(rowLog);
    }

    // Don't increment counters - this is for existing rows with multimedia warnings
    this._updatedAt = new Date();

    this.addDomainEvent(
      new BulkProcessingRowProcessedEvent(
        this._id,
        this._type,
        this._companyId,
        this._requestedBy,
        rowLog.rowNumber,
        rowLog.entityId,
        rowLog.errors.length === 0,
        rowLog.entityType,
        rowLog.metadata,
      ),
    );
  }

  // Método para actualizar contadores sin agregar logs
  updateCounters(processedRows: number, successfulRows: number, failedRows: number): void {
    this._processedRows = processedRows;
    this._successfulRows = successfulRows;
    this._failedRows = failedRows;
    this._updatedAt = new Date();

    this.addDomainEvent(
      new BulkProcessingRowProcessedEvent(
        this._id,
        this._type,
        this._companyId,
        this._requestedBy,
        0, // rowNumber no aplicable para contadores batch
        undefined, // entityId no aplicable
        successfulRows > 0, // isSuccessful
        'Batch', // entityType para indicar update batch
        { processedRows, successfulRows, failedRows }, // metadata con contadores
      ),
    );
  }

  complete(totalRows?: number): void {
    if (this._status !== BulkProcessingStatus.PROCESSING) {
      throw new InvalidValueObjectException(
        `Cannot complete bulk processing request with status: ${this._status}`,
      );
    }

    this._status = BulkProcessingStatus.COMPLETED;
    const oldTotalRows = this._totalRows;
    if (totalRows !== undefined) {
      this._totalRows = totalRows;
    }
    this._completedAt = new Date();
    this._updatedAt = new Date();

    this.addDomainEvent(
      new BulkProcessingRequestCompletedEvent(
        this._id,
        this._type,
        this._companyId,
        this._requestedBy,
        this._processedRows,
        this._successfulRows,
        this._failedRows,
        oldTotalRows,
        this._totalRows,
      ),
    );
  }

  fail(errorMessage: string): void {
    if (this._status === BulkProcessingStatus.COMPLETED) {
      throw new InvalidValueObjectException('Cannot fail a completed bulk processing request');
    }

    this._status = BulkProcessingStatus.FAILED;
    this._errorMessage = errorMessage;
    this._completedAt = new Date();
    this._updatedAt = new Date();

    this.addDomainEvent(
      new BulkProcessingRequestFailedEvent(
        this._id,
        this._type,
        this._companyId,
        this._requestedBy,
        errorMessage,
        this._processedRows,
        this._successfulRows,
        this._failedRows,
      ),
    );
  }

  markExcelProcessingCompleted(): void {
    this._excelProcessingCompleted = true;
    this._updatedAt = new Date();
  }

  isCancellable(): boolean {
    if (
      this._status === BulkProcessingStatus.COMPLETED ||
      this._status === BulkProcessingStatus.FAILED ||
      this._status === BulkProcessingStatus.CANCELLED ||
      this._status === BulkProcessingStatus.CANCELLING
    ) {
      return false;
    }

    return true;
  }

  startCancellation(): void {
    if (!this.isCancellable()) {
      throw new InvalidValueObjectException(
        `Cannot cancel bulk processing request with status: ${this._status}`,
      );
    }

    this._status = BulkProcessingStatus.CANCELLING;
    this._updatedAt = new Date();

    this.addDomainEvent(
      new BulkProcessingRequestCancellationStartedEvent(
        this._id,
        this._type,
        this._companyId,
        this._requestedBy,
        this._processedRows,
        this._successfulRows,
        this._failedRows,
      ),
    );
  }

  cancel(): void {
    // Allow transition from CANCELLING to CANCELLED
    if (!this.isCancelling() && !this.isCancellable()) {
      throw new InvalidValueObjectException(
        `Cannot cancel bulk processing request with status: ${this._status}`,
      );
    }

    this._status = BulkProcessingStatus.CANCELLED;
    this._jobId = null;
    this._completedAt = new Date();
    this._updatedAt = new Date();

    this.addDomainEvent(
      new BulkProcessingRequestCancelledEvent(
        this._id,
        this._type,
        this._companyId,
        this._requestedBy,
        this._processedRows,
        this._successfulRows,
        this._failedRows,
      ),
    );
  }

  belongsToCompany(companyId: string): boolean {
    return this._companyId.getValue() === companyId;
  }

  isRequestedBy(userId: string): boolean {
    return this._requestedBy.getValue() === userId;
  }

  isInProgress(): boolean {
    return this._status === BulkProcessingStatus.PROCESSING;
  }

  isCompleted(): boolean {
    return this._status === BulkProcessingStatus.COMPLETED;
  }

  isPending(): boolean {
    return this._status === BulkProcessingStatus.PENDING;
  }

  isCancelled(): boolean {
    return this._status === BulkProcessingStatus.CANCELLED;
  }

  isCancelling(): boolean {
    return this._status === BulkProcessingStatus.CANCELLING;
  }

  hasFailed(): boolean {
    return this._status === BulkProcessingStatus.FAILED;
  }

  hasErrors(): boolean {
    return this._rowLogs.some(log => log.errors.length > 0);
  }

  getErrorLogs(): IBulkProcessingRowLog[] {
    return this._rowLogs.filter(log => log.errors.length > 0);
  }

  hasWarnings(): boolean {
    return this._rowLogs.some(log => log.warnings.length > 0);
  }

  getWarningLogs(): IBulkProcessingRowLog[] {
    return this._rowLogs.filter(log => log.warnings.length > 0);
  }

  updateMetadata(newMetadata: Record<string, any>): void {
    this._metadata = { ...this._metadata, ...newMetadata };
    this._updatedAt = new Date();
  }
}
