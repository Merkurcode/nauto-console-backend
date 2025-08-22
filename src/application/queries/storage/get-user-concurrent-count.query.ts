import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IConcurrencyService } from '@core/repositories/concurrency.service.interface';
import { CONCURRENCY_SERVICE } from '@shared/constants/tokens';

export class GetUserConcurrentCountQuery {
  constructor(public readonly userId: string) {}
}

@QueryHandler(GetUserConcurrentCountQuery)
export class GetUserConcurrentCountHandler implements IQueryHandler<GetUserConcurrentCountQuery> {
  constructor(
    @Inject(CONCURRENCY_SERVICE)
    private readonly concurrencyService: IConcurrencyService,
  ) {}

  async execute(
    query: GetUserConcurrentCountQuery,
  ): Promise<{ userId: string; activeUploads: number }> {
    const activeUploads = await this.concurrencyService.getCurrentCount(query.userId);

    return { userId: query.userId, activeUploads };
  }
}
