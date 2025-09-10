/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { IBulkProcessingRequestRepository } from '@core/repositories/bulk-processing-request.repository.interface';
import {
  BulkProcessingRequest,
  IBulkProcessingRowLog,
} from '@core/entities/bulk-processing-request.entity';
import { BulkProcessingType } from '@shared/constants/bulk-processing-type.enum';
import { BulkProcessingStatus } from '@shared/constants/bulk-processing-status.enum';
import {
  BulkProcessingRequest as PrismaBulkProcessingRequest,
  BulkProcessingType as PrismaBulkProcessingType,
  BulkProcessingStatus as PrismaBulkProcessingStatus,
} from '@prisma/client';
import { BaseRepository } from './base.repository';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { RequestCacheService } from '@infrastructure/caching/request-cache.service';

@Injectable()
export class BulkProcessingRequestRepository
  extends BaseRepository<BulkProcessingRequest>
  implements IBulkProcessingRequestRepository
{
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionContextService)
    private readonly transactionContext: TransactionContextService,
    @Optional() @Inject(LOGGER_SERVICE) private readonly logger?: ILogger,
    @Optional() _requestCache?: RequestCacheService,
  ) {
    logger?.setContext(BulkProcessingRequestRepository.name);
    super(logger, undefined);
  }

  private get client() {
    return this.transactionContext.getTransactionClient() || this.prisma;
  }

  async create(request: BulkProcessingRequest): Promise<BulkProcessingRequest> {
    return this.executeWithErrorHandling('create', async () => {
      const data = await this.client.bulkProcessingRequest.create({
        data: {
          id: request.id.toString(),
          type: request.type as PrismaBulkProcessingType,
          fileId: request.fileId.toString(),
          fileName: request.fileName,
          status: request.status as PrismaBulkProcessingStatus,
          jobId: request.jobId,
          totalRows: request.totalRows,
          processedRows: request.processedRows,
          successfulRows: request.successfulRows,
          failedRows: request.failedRows,
          rowLogs: JSON.stringify(request.rowLogs),
          metadata: JSON.stringify(request.metadata),
          errorMessage: request.errorMessage,
          startedAt: request.startedAt,
          completedAt: request.completedAt,
          excelProcessingCompleted: request.excelProcessingCompleted,
          companyId: request.companyId.toString(),
          requestedBy: request.requestedBy.toString(),
          createdAt: request.createdAt,
          updatedAt: request.updatedAt,
        },
      });

      return this.mapToModel(data);
    });
  }

  async update(request: BulkProcessingRequest): Promise<BulkProcessingRequest> {
    return this.executeWithErrorHandling('update', async () => {
      const data = await this.client.bulkProcessingRequest.update({
        where: {
          id: request.id.toString(),
        },
        data: {
          status: request.status as PrismaBulkProcessingStatus,
          jobId: request.jobId,
          totalRows: request.totalRows,
          processedRows: request.processedRows,
          successfulRows: request.successfulRows,
          failedRows: request.failedRows,
          rowLogs: JSON.stringify(request.rowLogs),
          metadata: JSON.stringify(request.metadata),
          errorMessage: request.errorMessage,
          startedAt: request.startedAt,
          completedAt: request.completedAt,
          excelProcessingCompleted: request.excelProcessingCompleted,
          updatedAt: request.updatedAt,
        },
      });

      return this.mapToModel(data);
    });
  }

  async findByIdAndCompany(id: string, companyId: string): Promise<BulkProcessingRequest | null> {
    return this.executeWithErrorHandling(
      'findByIdAndCompany',
      async () => {
        const data = await this.client.bulkProcessingRequest.findFirst({
          where: {
            id,
            companyId,
          },
        });

        return data ? this.mapToModel(data) : null;
      },
      undefined,
      { id, companyId },
    );
  }

  async findByJobIddAndCompany(
    jobId: string,
    companyId: string,
  ): Promise<BulkProcessingRequest | null> {
    return this.executeWithErrorHandling(
      'findByJobIddAndCompany',
      async () => {
        const data = await this.client.bulkProcessingRequest.findFirst({
          where: {
            jobId,
            companyId,
          },
        });

        return data ? this.mapToModel(data) : null;
      },
      undefined,
      { jobId, companyId },
    );
  }

  async findByCompanyId(
    companyId: string,
    limit?: number,
    offset?: number,
  ): Promise<BulkProcessingRequest[]> {
    return this.executeWithErrorHandling('findByCompanyId', async () => {
      const records = await this.client.bulkProcessingRequest.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      return records.map(record => this.mapToModel(record));
    });
  }

  async findByStatusAndCompany(
    status: BulkProcessingStatus,
    companyId: string,
    limit?: number,
    offset?: number,
  ): Promise<BulkProcessingRequest[]> {
    return this.executeWithErrorHandling('findByStatusAndCompany', async () => {
      const records = await this.client.bulkProcessingRequest.findMany({
        where: {
          status: status as PrismaBulkProcessingStatus,
          companyId,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      return records.map(record => this.mapToModel(record));
    });
  }

  async findByTypeAndCompany(
    type: BulkProcessingType,
    companyId: string,
    limit?: number,
    offset?: number,
  ): Promise<BulkProcessingRequest[]> {
    return this.executeWithErrorHandling('findByTypeAndCompany', async () => {
      const records = await this.client.bulkProcessingRequest.findMany({
        where: {
          type: type as PrismaBulkProcessingType,
          companyId,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      return records.map(record => this.mapToModel(record));
    });
  }

  async findByUserAndCompany(
    userId: string,
    companyId: string,
    limit?: number,
    offset?: number,
  ): Promise<BulkProcessingRequest[]> {
    return this.executeWithErrorHandling('findByUserAndCompany', async () => {
      const records = await this.client.bulkProcessingRequest.findMany({
        where: {
          requestedBy: userId,
          companyId,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      return records.map(record => this.mapToModel(record));
    });
  }

  async countByCompany(companyId: string): Promise<number> {
    return this.executeWithErrorHandling('countByCompany', async () => {
      return await this.client.bulkProcessingRequest.count({
        where: { companyId },
      });
    });
  }

  async countByStatusAndCompany(status: BulkProcessingStatus, companyId: string): Promise<number> {
    return this.executeWithErrorHandling('countByStatusAndCompany', async () => {
      return await this.client.bulkProcessingRequest.count({
        where: {
          status: status as PrismaBulkProcessingStatus,
          companyId,
        },
      });
    });
  }

  async delete(id: string, companyId: string): Promise<void> {
    return this.executeWithErrorHandling('delete', async () => {
      await this.client.bulkProcessingRequest.delete({
        where: {
          id,
          companyId,
        },
      });
    });
  }

  async exists(id: string, companyId: string): Promise<boolean> {
    return this.executeWithErrorHandling('exists', async () => {
      const count = await this.client.bulkProcessingRequest.count({
        where: {
          id,
          companyId,
        },
      });

      return count > 0;
    });
  }

  async findActiveByCompany(companyId: string): Promise<BulkProcessingRequest[]> {
    return this.executeWithErrorHandling('findActiveByCompany', async () => {
      const records = await this.client.bulkProcessingRequest.findMany({
        where: {
          companyId,
          status: PrismaBulkProcessingStatus.PROCESSING,
        },
        orderBy: { createdAt: 'desc' },
      });

      return records.map(record => this.mapToModel(record));
    });
  }

  private mapToModel(record: PrismaBulkProcessingRequest): BulkProcessingRequest {
    let rowLogs: IBulkProcessingRowLog[] = [];
    let metadata: Record<string, any> = {};

    if (record.rowLogs) {
      try {
        rowLogs = JSON.parse(record.rowLogs as string);
      } catch (error) {
        this.logger?.warn(
          `Failed to parse rowLogs for request ${record.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
        rowLogs = [];
      }
    }

    if (record.metadata) {
      try {
        metadata = JSON.parse(record.metadata as string);
      } catch (error) {
        this.logger?.warn(
          `Failed to parse metadata for request ${record.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
        metadata = {};
      }
    }

    return BulkProcessingRequest.fromData({
      id: record.id,
      type: record.type as BulkProcessingType,
      fileId: record.fileId,
      fileName: record.fileName,
      status: record.status as BulkProcessingStatus,
      jobId: record.jobId,
      totalRows: record.totalRows,
      processedRows: record.processedRows,
      successfulRows: record.successfulRows,
      failedRows: record.failedRows,
      rowLogs,
      metadata,
      errorMessage: record.errorMessage,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      excelProcessingCompleted: record.excelProcessingCompleted,
      companyId: record.companyId,
      requestedBy: record.requestedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
