import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IBulkProcessingRequestRepository } from '@core/repositories/bulk-processing-request.repository.interface';
import { BULK_PROCESSING_REQUEST_REPOSITORY } from '@shared/constants/tokens';
import {
  BulkProcessingRequestNotFoundException,
  UnauthorizedBulkProcessingRequestAccessException,
} from '@core/exceptions/bulk-processing.exceptions';
import { IBulkProcessingRowLog } from '@core/entities/bulk-processing-request.entity';

export class GetBulkProcessingErrorReportQuery implements IQuery {
  constructor(
    public readonly requestId: string,
    public readonly companyId: string,
  ) {}
}

@QueryHandler(GetBulkProcessingErrorReportQuery)
export class GetBulkProcessingErrorReportHandler
  implements IQueryHandler<GetBulkProcessingErrorReportQuery>
{
  constructor(
    @Inject(BULK_PROCESSING_REQUEST_REPOSITORY)
    private readonly bulkProcessingRequestRepository: IBulkProcessingRequestRepository,
  ) {}

  async execute(query: GetBulkProcessingErrorReportQuery): Promise<IBulkProcessingRowLog[]> {
    const { requestId, companyId } = query;

    const bulkRequest = await this.bulkProcessingRequestRepository.findByIdAndCompany(
      requestId,
      companyId,
    );

    if (!bulkRequest) {
      throw new BulkProcessingRequestNotFoundException(requestId);
    }

    // Verify user has access
    if (!bulkRequest.belongsToCompany(companyId)) {
      throw new UnauthorizedBulkProcessingRequestAccessException(requestId, companyId);
    }

    // Return only error logs directly
    const errorLogs = bulkRequest.getErrorLogs();

    if (errorLogs.length === 0) {
      return null;
    }

    return errorLogs;
  }
}
