import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IBulkProcessingRequestRepository } from '@core/repositories/bulk-processing-request.repository.interface';
import { BULK_PROCESSING_REQUEST_REPOSITORY } from '@shared/constants/tokens';
import {
  BulkProcessingRequestNotFoundException,
  UnauthorizedBulkProcessingRequestAccessException,
} from '@core/exceptions/bulk-processing.exceptions';
import { IBulkProcessingRequestResponse } from '@application/dtos/_responses/bulk-processing-request/bulk-processing-request.response.interface';
import { BulkProcessingRequestMapper } from '@application/mappers/bulk-processing-request.mapper';

export class GetBulkProcessingRequestQuery implements IQuery {
  constructor(
    public readonly requestId: string,
    public readonly companyId: string,
  ) {}
}

@QueryHandler(GetBulkProcessingRequestQuery)
export class GetBulkProcessingRequestHandler
  implements IQueryHandler<GetBulkProcessingRequestQuery, IBulkProcessingRequestResponse>
{
  constructor(
    @Inject(BULK_PROCESSING_REQUEST_REPOSITORY)
    private readonly bulkProcessingRequestRepository: IBulkProcessingRequestRepository,
  ) {}

  async execute(query: GetBulkProcessingRequestQuery): Promise<IBulkProcessingRequestResponse> {
    const { requestId, companyId } = query;

    const bulkRequest = await this.bulkProcessingRequestRepository.findByIdAndCompany(
      requestId,
      companyId,
    );

    if (!bulkRequest) {
      throw new BulkProcessingRequestNotFoundException(requestId);
    }

    if (!bulkRequest.belongsToCompany(companyId)) {
      throw new UnauthorizedBulkProcessingRequestAccessException(requestId, companyId);
    }

    return BulkProcessingRequestMapper.toResponse(bulkRequest);
  }
}
