import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { ISessionRepository } from '@core/repositories/session.repository.interface';
import { Session } from '@core/entities/session.entity';

@Injectable()
export class SessionRepository implements ISessionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionContext: TransactionContextService,
  ) {}

  private get client() {
    return this.transactionContext.getTransactionClient() || this.prisma;
  }

  async create(session: Session): Promise<Session> {
    const data = session.toPersistence();

    const created = await this.client.sessions.create({
      data,
    });

    return Session.fromData(created);
  }

  async findById(id: string): Promise<Session | null> {
    const session = await this.client.sessions.findUnique({
      where: { id },
    });

    return session ? Session.fromData(session) : null;
  }

  async findBySessionToken(sessionToken: string): Promise<Session | null> {
    const session = await this.client.sessions.findUnique({
      where: { sessionToken },
    });

    return session ? Session.fromData(session) : null;
  }

  async findByRefreshToken(refreshToken: string): Promise<Session | null> {
    const session = await this.client.sessions.findUnique({
      where: { refreshToken },
    });

    return session ? Session.fromData(session) : null;
  }

  async findByUserId(userId: string): Promise<Session[]> {
    const sessions = await this.client.sessions.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map(session => Session.fromData(session));
  }

  async update(session: Session): Promise<Session> {
    const data = session.toPersistence();

    const updated = await this.client.sessions.update({
      where: { id: data.id },
      data: {
        updatedAt: data.updatedAt,
      },
    });

    return Session.fromData(updated);
  }

  async delete(id: string): Promise<void> {
    await this.client.sessions.delete({
      where: { id },
    });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.client.sessions.deleteMany({
      where: { userId },
    });
  }

  async deleteBySessionToken(sessionToken: string): Promise<void> {
    await this.client.sessions.deleteMany({
      where: { sessionToken },
    });
  }

  async deleteByRefreshToken(refreshToken: string): Promise<void> {
    await this.client.sessions.deleteMany({
      where: { refreshToken },
    });
  }
}
