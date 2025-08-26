/* eslint-disable newline-before-return */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject } from '@nestjs/common';
import Redis, { Cluster } from 'ioredis';
import { IConcurrencyService } from '@core/repositories/concurrency.service.interface';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE, CONCURRENCY_SERVICE, REDIS_CLIENT } from '@shared/constants/tokens';

@Processor('uploads-maint', { concurrency: 1 })
export class UploadsMaintenanceWorker extends WorkerHost {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis | Cluster,
    @Inject(CONCURRENCY_SERVICE) private readonly conc: IConcurrencyService,
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
  ) {
    super();
    this.logger.setContext(UploadsMaintenanceWorker.name);
  }

  async process(
    job: Job<{ scanCount?: number; maxMs?: number }>,
  ): Promise<{ checked: number; removed: number; finished: boolean }> {
    const scanCount = Math.max(50, Math.min(job.data?.scanCount ?? 500, 5000));
    const maxMs = Math.max(500, Math.min(job.data?.maxMs ?? 4000, 60000));

    const start = Date.now();
    const setKey = this.conc.activeUsersSet();
    const userKeyFor = (u: string) => this.conc.userKey(u);

    let cursor = '0';
    let checked = 0;
    let removed = 0;

    try {
      do {
        const [next, members] = (await this.redis.sscan(setKey, cursor, 'COUNT', scanCount)) as [
          string,
          string[],
        ];
        cursor = next;

        if (members?.length) {
          const p1 = this.redis.pipeline();
          for (const u of members) p1.get(userKeyFor(u));
          const res = (await p1.exec()) as Array<[Error | null, string | null]>;

          const toRemove: string[] = [];
          res.forEach(([err, val], idx) => {
            if (err) return;
            const n = val ? parseInt(val, 10) || 0 : 0;
            if (n <= 0) toRemove.push(members[idx]);
          });

          checked += members.length;

          if (toRemove.length) {
            const p2 = this.redis.pipeline();
            toRemove.forEach(u => p2.srem(setKey, u));
            await p2.exec();
            removed += toRemove.length;
          }
        }

        if (Date.now() - start > maxMs) {
          this.logger.debug(
            `Cleanup parcial: checked=${checked}, removed=${removed}, continuará en próxima corrida`,
          );
          return { checked, removed, finished: false };
        }
      } while (cursor !== '0');

      this.logger.debug(`Cleanup completo: checked=${checked}, removed=${removed}`);
      return { checked, removed, finished: true };
    } catch (err) {
      this.logger.warn(`Cleanup error: ${(err as Error).message}`);
      return { checked, removed, finished: cursor === '0' };
    }
  }
}
