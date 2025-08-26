import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IConcurrencyService } from '@core/repositories/concurrency.service.interface';
import { CONCURRENCY_SERVICE } from '@shared/constants/tokens';

export class GetConcurrencyStatsQuery {
  constructor() {}
}

@QueryHandler(GetConcurrencyStatsQuery)
export class GetConcurrencyStatsHandler implements IQueryHandler<GetConcurrencyStatsQuery> {
  constructor(
    @Inject(CONCURRENCY_SERVICE)
    private readonly concurrencyService: IConcurrencyService,
  ) {}

  async execute(_query: GetConcurrencyStatsQuery): Promise<{
    totalActiveUsers: number;
    totalActiveUploads: number;
    averageUploadsPerUser: number;
  }> {
    return this.concurrencyService.getStats();
  }
}
