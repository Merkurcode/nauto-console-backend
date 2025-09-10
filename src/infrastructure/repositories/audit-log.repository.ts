import { Injectable, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { TransactionContextService } from '../database/prisma/transaction-context.service';
import { BaseRepository } from './base.repository';
import {
  IAuditLogRepository,
  IAuditLogQuery,
  IAuditLogQueryResult,
  IAuditLogFilters,
} from '@core/repositories/audit-log.repository.interface';
import {
  AuditLog,
  AuditLogLevel,
  AuditLogType,
  AuditLogAction,
} from '@core/entities/audit-log.entity';
import { AuditLogId } from '@core/value-objects/audit-log-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { RequestCacheService } from '@infrastructure/caching/request-cache.service';
import {
  IPrismaAuditLogData,
  IAuditLogMetadata,
} from '@core/interfaces/repositories/prisma-data.interface';
import { Prisma } from '@prisma/client';

/**
 * Audit Log Repository Implementation using Prisma
 * Infrastructure layer - implements domain interface
 * NOTE: This repository uses a special transaction pattern where audit logs
 * are persisted OUTSIDE of transactions by default to ensure they are saved
 * even if the main operation fails.
 */
@Injectable()
export class AuditLogRepository extends BaseRepository<AuditLog> implements IAuditLogRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionContext: TransactionContextService,
    @Optional() @Inject(LOGGER_SERVICE) private readonly logger?: ILogger,
    @Optional() _requestCache?: RequestCacheService,
  ) {
    logger?.setContext(AuditLogRepository.name);
    super(logger, undefined); // Audit logs should not be cached
  }

  async save(auditLog: AuditLog, useTransaction = false): Promise<AuditLog> {
    return this.executeWithErrorHandling('save', async () => {
      // IMPORTANT: Audit logs should be saved OUTSIDE of transactions by default
      // to ensure they are persisted even if the main operation fails
      // Only use transaction context if explicitly requested
      const client = useTransaction
        ? this.transactionContext.getTransactionClient() || this.prisma
        : this.prisma;

      try {
        const data = await client.auditLog.create({
          data: {
            id: auditLog.id.getValue(),
            level: auditLog.level,
            type: auditLog.type,
            action: auditLog.action,
            message: auditLog.message,
            userId: auditLog.userId?.getValue() || null,
            metadata: auditLog.metadata as IAuditLogMetadata,
            timestamp: auditLog.timestamp,
            context: auditLog.context,
          },
        });

        return this.toDomain(data);
      } catch (error) {
        throw error;
      }
    });
  }

  async findById(id: AuditLogId): Promise<AuditLog | null> {
    return this.executeWithErrorHandling('findById', async () => {
      const client = this.transactionContext.getTransactionClient() || this.prisma;

      const data = await client.auditLog.findUnique({
        where: { id: id.getValue() },
      });

      return data ? this.toDomain(data) : null;
    });
  }

  async query(query: IAuditLogQuery): Promise<IAuditLogQueryResult> {
    return this.executeWithErrorHandling('query', async () => {
      const client = this.transactionContext.getTransactionClient() || this.prisma;

      const {
        filters = {},
        page = 1,
        limit = 50,
        sortBy = 'timestamp',
        sortOrder = 'desc',
      } = query;

      // Build where clause
      const where = this.buildWhereClause(filters);

      // Build order by clause
      const orderBy = this.buildOrderByClause(sortBy, sortOrder);

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Execute queries in parallel
      const [logs, total] = await Promise.all([
        client.auditLog.findMany({
          where,
          orderBy,
          skip,
          take: limit,
        }),
        client.auditLog.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        logs: logs.map(log => this.toDomain(log)),
        total,
        page,
        limit,
        totalPages,
      };
    });
  }

  async findByUserId(userId: UserId, limit: number = 100): Promise<AuditLog[]> {
    return this.executeWithErrorHandling('findByUserId', async () => {
      const client = this.transactionContext.getTransactionClient() || this.prisma;

      const logs = await client.auditLog.findMany({
        where: { userId: userId.getValue() },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      return logs.map(log => this.toDomain(log));
    });
  }

  async findByContext(context: string, limit: number = 100): Promise<AuditLog[]> {
    return this.executeWithErrorHandling('findByContext', async () => {
      const client = this.transactionContext.getTransactionClient() || this.prisma;

      const logs = await client.auditLog.findMany({
        where: { context },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      return logs.map(log => this.toDomain(log));
    });
  }

  async findByTypeAndLevel(
    type: AuditLogType,
    level: AuditLogLevel,
    limit: number = 100,
  ): Promise<AuditLog[]> {
    return this.executeWithErrorHandling('findByTypeAndLevel', async () => {
      const client = this.transactionContext.getTransactionClient() || this.prisma;

      const logs = await client.auditLog.findMany({
        where: { type, level },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      return logs.map(log => this.toDomain(log));
    });
  }

  async findRecentErrors(hours: number, limit: number = 100): Promise<AuditLog[]> {
    return this.executeWithErrorHandling('findRecentErrors', async () => {
      const client = this.transactionContext.getTransactionClient() || this.prisma;
      const fromDate = new Date();
      fromDate.setHours(fromDate.getHours() - hours);

      const logs = await client.auditLog.findMany({
        where: {
          level: 'error',
          timestamp: {
            gte: fromDate,
          },
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      return logs.map(log => this.toDomain(log));
    });
  }

  async findSecurityLogs(fromDate: Date, toDate: Date, limit: number = 1000): Promise<AuditLog[]> {
    return this.executeWithErrorHandling('findSecurityLogs', async () => {
      const client = this.transactionContext.getTransactionClient() || this.prisma;

      const logs = await client.auditLog.findMany({
        where: {
          OR: [{ type: 'security' }, { type: 'auth' }, { context: 'security' }],
          timestamp: {
            gte: fromDate,
            lte: toDate,
          },
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      return logs.map(log => this.toDomain(log));
    });
  }

  async count(filters: IAuditLogFilters = {}): Promise<number> {
    return this.executeWithErrorHandling('count', async () => {
      const client = this.transactionContext.getTransactionClient() || this.prisma;
      const where = this.buildWhereClause(filters);

      return client.auditLog.count({ where });
    });
  }

  async deleteOlderThan(date: Date): Promise<number> {
    return this.executeWithErrorHandling('deleteOlderThan', async () => {
      const client = this.transactionContext.getTransactionClient() || this.prisma;

      const result = await client.auditLog.deleteMany({
        where: {
          timestamp: {
            lt: date,
          },
        },
      });

      return result.count;
    });
  }

  async getStatistics(fromDate: Date, toDate: Date) {
    return this.executeWithErrorHandling('getStatistics', async () => {
      const client = this.transactionContext.getTransactionClient() || this.prisma;

      const totalLogs = await client.auditLog.count({
        where: {
          timestamp: {
            gte: fromDate,
            lte: toDate,
          },
        },
      });

      // Get statistics by level
      const levelStats = await client.auditLog.groupBy({
        by: ['level'],
        where: {
          timestamp: {
            gte: fromDate,
            lte: toDate,
          },
        },
        _count: true,
      });

      // Get statistics by type
      const typeStats = await client.auditLog.groupBy({
        by: ['type'],
        where: {
          timestamp: {
            gte: fromDate,
            lte: toDate,
          },
        },
        _count: true,
      });

      // Get statistics by context
      const contextStats = await client.auditLog.groupBy({
        by: ['context'],
        where: {
          timestamp: {
            gte: fromDate,
            lte: toDate,
          },
        },
        _count: true,
      });

      return {
        totalLogs,
        byLevel: levelStats.reduce(
          (acc, stat) => {
            acc[stat.level as AuditLogLevel] = stat._count;

            return acc;
          },
          {} as Record<AuditLogLevel, number>,
        ),
        byType: typeStats.reduce(
          (acc, stat) => {
            acc[stat.type as AuditLogType] = stat._count;

            return acc;
          },
          {} as Record<AuditLogType, number>,
        ),
        byContext: contextStats.reduce(
          (acc, stat) => {
            acc[stat.context] = stat._count;

            return acc;
          },
          {} as Record<string, number>,
        ),
      };
    });
  }

  /**
   * Build WHERE clause from filters
   */
  private buildWhereClause(filters: IAuditLogFilters): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};

    if (filters.level && filters.level.length > 0) {
      where.level = { in: filters.level };
    }

    if (filters.type && filters.type.length > 0) {
      where.type = { in: filters.type };
    }

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.context && filters.context.length > 0) {
      where.context = { in: filters.context };
    }

    if (filters.fromDate || filters.toDate) {
      where.timestamp = {};
      if (filters.fromDate) {
        where.timestamp.gte = filters.fromDate;
      }
      if (filters.toDate) {
        where.timestamp.lte = filters.toDate;
      }
    }

    if (filters.ipAddress) {
      where.metadata = {
        path: ['ipAddress'],
        equals: filters.ipAddress,
      };
    }

    if (filters.search) {
      where.OR = [
        { message: { contains: filters.search, mode: 'insensitive' as const } },
        { context: { contains: filters.search, mode: 'insensitive' as const } },
        { type: { contains: filters.search, mode: 'insensitive' as const } },
        { action: { contains: filters.search, mode: 'insensitive' as const } },
      ];
    }

    return where;
  }

  /**
   * Build ORDER BY clause
   */
  private buildOrderByClause(sortBy: string, sortOrder: 'asc' | 'desc'): Record<string, string> {
    const validSortFields = ['timestamp', 'level', 'type', 'context'];
    const field = validSortFields.includes(sortBy) ? sortBy : 'timestamp';

    return { [field]: sortOrder };
  }

  /**
   * Convert Prisma model to domain entity
   */
  private toDomain(data: IPrismaAuditLogData): AuditLog {
    return AuditLog.create(
      data.level as AuditLogLevel,
      data.type as AuditLogType,
      data.action as AuditLogAction,
      data.message,
      data.userId ? UserId.fromString(data.userId) : null,
      this.parseMetadata(data.metadata),
      data.context,
    );
  }

  private parseMetadata(jsonValue: unknown): IAuditLogMetadata {
    if (typeof jsonValue === 'object' && jsonValue !== null && !Array.isArray(jsonValue)) {
      return jsonValue as IAuditLogMetadata;
    }

    return {};
  }
}
