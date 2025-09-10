import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IBulkProcessingRequestRepository } from '@core/repositories/bulk-processing-request.repository.interface';
import { BULK_PROCESSING_REQUEST_REPOSITORY } from '@shared/constants/tokens';
import {
  BulkProcessingRequestNotFoundException,
  UnauthorizedBulkProcessingRequestAccessException,
} from '@core/exceptions/bulk-processing.exceptions';
import { IBulkProcessingRowLog } from '@core/entities/bulk-processing-request.entity';

export class GetBulkProcessingWarningReportQuery implements IQuery {
  constructor(
    public readonly requestId: string,
    public readonly companyId: string,
  ) {}
}

@QueryHandler(GetBulkProcessingWarningReportQuery)
export class GetBulkProcessingWarningReportHandler
  implements IQueryHandler<GetBulkProcessingWarningReportQuery>
{
  constructor(
    @Inject(BULK_PROCESSING_REQUEST_REPOSITORY)
    private readonly bulkProcessingRequestRepository: IBulkProcessingRequestRepository,
  ) {}

  async execute(query: GetBulkProcessingWarningReportQuery): Promise<IBulkProcessingRowLog[]> {
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

    // Return only warning logs directly
    const warningLogs = bulkRequest.getWarningLogs();

    if (warningLogs.length === 0) {
      return null;
    }

    return warningLogs;
  }
}
