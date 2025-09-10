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

  async delete(id: string): Promise<void> {
    return this.executeWithErrorHandling('delete', async () => {
      await this.client.sessions.delete({
        where: { id },
      });
    });
  }

  async deleteByUserId(userId: string): Promise<void> {
    return this.executeWithErrorHandling('deleteByUserId', async () => {
      await this.client.sessions.deleteMany({
        where: { userId },
      });
    });
  }

  async deleteByUserIdExcept(userId: string, excludeSessionToken: string): Promise<void> {
    return this.executeWithErrorHandling('deleteByUserIdExcept', async () => {
      await this.client.sessions.deleteMany({
        where: {
          userId,
          sessionToken: {
            not: excludeSessionToken,
          },
        },
      });
    });
  }

  async deleteBySessionToken(sessionToken: string): Promise<void> {
    return this.executeWithErrorHandling('deleteBySessionToken', async () => {
      await this.client.sessions.deleteMany({
        where: { sessionToken },
      });
    });
  }

  async deleteByRefreshToken(refreshToken: string): Promise<void> {
    return this.executeWithErrorHandling('deleteByRefreshToken', async () => {
      await this.client.sessions.deleteMany({
        where: { refreshToken },
      });
    });
  }
}
