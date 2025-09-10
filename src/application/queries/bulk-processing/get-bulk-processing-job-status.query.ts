import { Injectable, Inject } from '@nestjs/common';
import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { BulkProcessingEventBus } from '@queues/all/bulk-processing/bulk-processing-event-bus';
import { IBulkProcessingJobData } from '@queues/all/bulk-processing/bulk-processing-config';

export class GetBulkProcessingJobStatusQuery implements IQuery {
  constructor(public readonly jobId: string) {}
}

export interface IGetBulkProcessingJobStatusResponse {
  exists: boolean;
  jobId: string;
  state?: string;
  progress?: number;
  data?: IBulkProcessingJobData;
  finishedOn?: number;
  processedOn?: number;
  failedReason?: string;
}

@Injectable()
@QueryHandler(GetBulkProcessingJobStatusQuery)
export class GetBulkProcessingJobStatusHandler
  implements IQueryHandler<GetBulkProcessingJobStatusQuery, IGetBulkProcessingJobStatusResponse>
{
  constructor(@Inject() private readonly bulkProcessingEventBus: BulkProcessingEventBus) {}

  async execute(
    query: GetBulkProcessingJobStatusQuery,
  ): Promise<IGetBulkProcessingJobStatusResponse> {
    const { jobId } = query;

    const jobStatus = await this.bulkProcessingEventBus.getBulkProcessingJobStatus(jobId);

    return {
      jobId,
      ...jobStatus,
    };
  }
}
