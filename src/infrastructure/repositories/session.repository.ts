import { Injectable, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { ISessionRepository } from '@core/repositories/session.repository.interface';
import { Session } from '@core/entities/session.entity';
import { BaseRepository } from './base.repository';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { RequestCacheService } from '@infrastructure/caching/request-cache.service';

@Injectable()
export class SessionRepository extends BaseRepository<Session> implements ISessionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionContext: TransactionContextService,
    @Optional() @Inject(LOGGER_SERVICE) logger?: ILogger,
    @Optional() requestCache?: RequestCacheService,
  ) {
    logger?.setContext(SessionRepository.name);
    super(logger, requestCache);
  }

  private get client() {
    return this.transactionContext.getTransactionClient() || this.prisma;
  }

  async create(session: Session): Promise<Session> {
    return this.executeWithErrorHandling('create', async () => {
      const data = session.toPersistence();

      const created = await this.client.sessions.create({
        data,
      });

      return Session.fromData(created);
    });
  }

  async findById(id: string): Promise<Session | null> {
    return this.executeWithErrorHandling('findById', async () => {
      const session = await this.client.sessions.findUnique({
        where: { id },
      });

      return session ? Session.fromData(session) : null;
    });
  }

  async findBySessionToken(sessionToken: string): Promise<Session | null> {
    return this.executeWithErrorHandling(
      'findBySessionToken',
      async () => {
        const session = await this.client.sessions.findUnique({
          where: { sessionToken },
        });

        return session ? Session.fromData(session) : null;
      },
      undefined,
      { sessionToken },
    );
  }

  async findByRefreshToken(refreshToken: string): Promise<Session | null> {
    return this.executeWithErrorHandling('findByRefreshToken', async () => {
      const session = await this.client.sessions.findUnique({
        where: { refreshToken },
      });

      return session ? Session.fromData(session) : null;
    });
  }

  async findByUserId(userId: string): Promise<Session[]> {
    return this.executeWithErrorHandling('findByUserId', async () => {
      const sessions = await this.client.sessions.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      return sessions.map(session => Session.fromData(session));
    });
  }

  async update(session: Session): Promise<Session> {
    return this.executeWithErrorHandling('update', async () => {
      const data = session.toPersistence();

      const updated = await this.client.sessions.update({
        where: { id: data.id },
        data: {
          updatedAt: data.updatedAt,
        },
      });

      return Session.fromData(updated);
    });
  }

  async delete(id: string): Promise<number> {
    return this.executeWithErrorHandling('delete', async () => {
      const result = await this.client.sessions.delete({
        where: { id },
      });

      return result && result.id === id ? 1 : 0; // delete() always deletes exactly 1 row or throws an error
    });
  }

  async deleteByUserId(userId: string): Promise<number> {
    return this.executeWithErrorHandling('deleteByUserId', async () => {
      const result = await this.client.sessions.deleteMany({
        where: { userId },
      });

      return result.count;
    });
  }

  async deleteByUserIdExcept(userId: string, excludeSessionToken: string): Promise<number> {
    return this.executeWithErrorHandling('deleteByUserIdExcept', async () => {
      const result = await this.client.sessions.deleteMany({
        where: {
          userId,
          sessionToken: {
            not: excludeSessionToken,
          },
        },
      });

      return result.count;
    });
  }

  async deleteBySessionToken(sessionToken: string): Promise<number> {
    return this.executeWithErrorHandling('deleteBySessionToken', async () => {
      const result = await this.client.sessions.deleteMany({
        where: { sessionToken },
      });

      return result.count;
    });
  }

  async deleteByRefreshToken(refreshToken: string): Promise<number> {
    return this.executeWithErrorHandling('deleteByRefreshToken', async () => {
      const result = await this.client.sessions.deleteMany({
        where: { refreshToken },
      });

      return result.count;
    });
  }
}
