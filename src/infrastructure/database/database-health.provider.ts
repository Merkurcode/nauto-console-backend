import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { IDatabaseHealth } from '@core/interfaces/database-health.interface';

/**
 * Database Health Provider
 * Infrastructure implementation of database health checking
 */
@Injectable()
export class DatabaseHealthProvider implements IDatabaseHealth {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Test database connectivity using Prisma
   * @throws DatabaseConnectionException if connection fails
   */
  async testConnection(): Promise<void> {
    await this.prismaService.$queryRaw`SELECT 1`;
  }
}
