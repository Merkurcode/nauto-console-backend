import { BulkProcessingRequest } from '@core/entities/bulk-processing-request.entity';
import { IBulkProcessingRequestResponse } from '@application/dtos/_responses/bulk-processing-request/bulk-processing-request.response.interface';
import { IBulkProcessingStatusResponse } from '@application/dtos/_responses/bulk-processing-request/bulk-processing-request.response';

export class BulkProcessingRequestMapper {
  static toResponse(entity: BulkProcessingRequest): IBulkProcessingRequestResponse {
    return {
      id: entity.id.toString(),
      type: entity.type,
      fileId: entity.fileId.toString(),
      fileName: entity.fileName,
      status: entity.status,
      jobId: entity.jobId,
      totalRows: entity.totalRows,
      processedRows: entity.processedRows,
      successfulRows: entity.successfulRows,
      failedRows: entity.failedRows,
      progressPercentage: entity.progressPercentage,
      errorMessage: entity.errorMessage,
      startedAt: entity.startedAt,
      completedAt: entity.completedAt,
      companyId: entity.companyId.toString(),
      requestedBy: entity.requestedBy.toString(),
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      hasErrors: entity.hasErrors(),
      rowLogs: entity.rowLogs,
      metadata: {
        isInProgress: entity.isInProgress(),
        isCompleted: entity.isCompleted(),
        hasFailed: entity.hasFailed(),
        errorLogsCount: entity.getErrorLogs().length,
      },
    };
  }

  static toStatusResponse(request: IBulkProcessingRequestResponse): IBulkProcessingStatusResponse {
    return {
      requestId: request.id,
      status: request.status,
      progressPercentage: request.progressPercentage,
      totalRows: request.totalRows,
      processedRows: request.processedRows,
      successfulRows: request.successfulRows,
      failedRows: request.failedRows,
      hasErrors: request.hasErrors,
      startedAt: request.startedAt,
      completedAt: request.completedAt,
      errorMessage: request.errorMessage,
    };
  }

  static toResponseList(entities: BulkProcessingRequest[]): IBulkProcessingRequestResponse[] {
    return entities.map(entity => this.toResponse(entity));
  }
}
