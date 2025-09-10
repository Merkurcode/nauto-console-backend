import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IBulkProcessingRequestRepository } from '@core/repositories/bulk-processing-request.repository.interface';
import { BULK_PROCESSING_REQUEST_REPOSITORY } from '@shared/constants/tokens';
import { BulkProcessingStatus } from '@shared/constants/bulk-processing-status.enum';
import { BulkProcessingType } from '@shared/constants/bulk-processing-type.enum';
import { IBulkProcessingRequestResponse } from '@application/dtos/_responses/bulk-processing-request/bulk-processing-request.response.interface';
import { BulkProcessingRequestMapper } from '@application/mappers/bulk-processing-request.mapper';
import { BulkProcessingRequest } from '@core/entities/bulk-processing-request.entity';

export class GetBulkProcessingRequestsByCompanyQuery implements IQuery {
  constructor(
    public readonly companyId: string,
    public readonly status?: BulkProcessingStatus,
    public readonly type?: BulkProcessingType,
    public readonly userId?: string,
    public readonly limit?: number,
    public readonly offset?: number,
  ) {}
}

@QueryHandler(GetBulkProcessingRequestsByCompanyQuery)
export class GetBulkProcessingRequestsByCompanyHandler
  implements
    IQueryHandler<GetBulkProcessingRequestsByCompanyQuery, IBulkProcessingRequestResponse[]>
{
  constructor(
    @Inject(BULK_PROCESSING_REQUEST_REPOSITORY)
    private readonly bulkProcessingRequestRepository: IBulkProcessingRequestRepository,
  ) {}

  async execute(
    query: GetBulkProcessingRequestsByCompanyQuery,
  ): Promise<IBulkProcessingRequestResponse[]> {
    const { companyId, status, type, userId, limit, offset } = query;

    let bulkRequests: BulkProcessingRequest[];

    if (status) {
      bulkRequests = await this.bulkProcessingRequestRepository.findByStatusAndCompany(
        status,
        companyId,
        limit,
        offset,
      );
    } else if (type) {
      bulkRequests = await this.bulkProcessingRequestRepository.findByTypeAndCompany(
        type,
        companyId,
        limit,
        offset,
      );
    } else if (userId) {
      bulkRequests = await this.bulkProcessingRequestRepository.findByUserAndCompany(
        userId,
        companyId,
        limit,
        offset,
      );
    } else {
      bulkRequests = await this.bulkProcessingRequestRepository.findByCompanyId(
        companyId,
        limit,
        offset,
      );
    }

    return bulkRequests
      ?.filter(request => request.belongsToCompany(companyId))
      ?.map(request => BulkProcessingRequestMapper.toResponse(request));
  }
}
