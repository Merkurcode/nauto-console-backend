import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IConcurrencyService } from '@core/repositories/concurrency.service.interface';
import { CONCURRENCY_SERVICE } from '@shared/constants/tokens';

export class GetConcurrencyHealthQuery {
  constructor() {}
}

@QueryHandler(GetConcurrencyHealthQuery)
export class GetConcurrencyHealthHandler implements IQueryHandler<GetConcurrencyHealthQuery> {
  constructor(
    @Inject(CONCURRENCY_SERVICE)
    private readonly concurrencyService: IConcurrencyService,
  ) {}

  async execute(_query: GetConcurrencyHealthQuery): Promise<{ healthy: boolean }> {
    const healthy = await this.concurrencyService.healthCheck();

    return { healthy };
  }
}
