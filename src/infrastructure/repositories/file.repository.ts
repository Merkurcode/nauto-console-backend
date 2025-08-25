/* eslint-disable prettier/prettier */
import { Injectable, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { TransactionContextService } from '../database/prisma/transaction-context.service';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { File } from '@core/entities/file.entity';
import { BaseRepository } from './base.repository';
import { FileStatus } from '@core/value-objects/file-status.vo';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { $Enums } from '@prisma/client';

/**
 * Interface representing file data from storage
 */
export interface IFileData {
  id: string;
  filename: string;
  originalName: string;
  path: string;
  objectKey?: string;
  mimeType: string;
  size: number;
  bucket: string;
  userId: string;
  isPublic: boolean;
  status: string;
  uploadId?: string | null;
  etag?: string | null;
  targetApps: string[];
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class FileRepository extends BaseRepository<File> implements IFileRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionContext: TransactionContextService,
    @Optional() @Inject(LOGGER_SERVICE) logger?: ILogger,
  ) {
    super(logger);
  }

  private get client() {
    return this.transactionContext.getTransactionClient() || this.prisma;
  }

  async findById(id: string): Promise<File | null> {
    return this.executeWithErrorHandling('findById', async () => {
      const fileData = await this.client.file.findUnique({
        where: { id },
      });

      return fileData ? this.mapToEntity(fileData) : null;
    });
  }

  async findByUserId(userId: string): Promise<File[]> {
    return this.executeWithErrorHandling('findByUserId', async () => {
      const files = await this.client.file.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      return files.map(file => this.mapToEntity(file));
    });
  }

  async findByUserIdAndStatus(userId: string, status: FileStatus): Promise<File[]> {
    return this.executeWithErrorHandling('findByUserIdAndStatus', async () => {
      const files = await this.client.file.findMany({
        where: { 
          userId,
          status: status.toString() as $Enums.FileStatus
        },
        orderBy: { createdAt: 'desc' },
      });

      return files.map(file => this.mapToEntity(file));
    });
  }

  async findByUserIdAndStatusIn(userId: string, statuses: FileStatus[]): Promise<File[]> {
    return this.executeWithErrorHandling('findByUserIdAndStatusIn', async () => {
      const statusStrings = statuses.map(status => status.toString());
      const files = await this.client.file.findMany({
        where: { 
          userId,
          status: {
            in: statusStrings as $Enums.FileStatus[]
          }
        },
        orderBy: { createdAt: 'desc' },
      });

      return files.map(file => this.mapToEntity(file));
    });
  }

  async findByUserIdPaginated(userId: string, limit: number, offset: number): Promise<{ files: File[]; total: number }> {
    return this.executeWithErrorHandling('findByUserIdPaginated', async () => {
      const [files, total] = await Promise.all([
        this.client.file.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.client.file.count({
          where: { userId },
        }),
      ]);

      return {
        files: files.map(file => this.mapToEntity(file)),
        total,
      };
    });
  }

  async findByUserIdAndStatusPaginated(userId: string, status: FileStatus, limit: number, offset: number): Promise<{ files: File[]; total: number }> {
    return this.executeWithErrorHandling('findByUserIdAndStatusPaginated', async () => {
      const statusString = status.toString() as $Enums.FileStatus;
      const [files, total] = await Promise.all([
        this.client.file.findMany({
          where: { 
            userId,
            status: statusString
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.client.file.count({
          where: { 
            userId,
            status: statusString
          },
        }),
      ]);

      return {
        files: files.map(file => this.mapToEntity(file)),
        total,
      };
    });
  }

  async findByPath(path: string): Promise<File[]> {
    return this.executeWithErrorHandling('findByPath', async () => {
      const files = await this.client.file.findMany({
        where: { path },
        orderBy: { createdAt: 'desc' },
      });

      return files.map(file => this.mapToEntity(file));
    });
  }

  async findByBucketPathAndFilename(bucket: string, path: string, filename: string): Promise<File[]> {
    return this.executeWithErrorHandling('findByBucketPathAndFilename', async () => {
      const files = await this.client.file.findMany({
        where: { 
          bucket,
          path,
          filename,
        },
        orderBy: { createdAt: 'desc' },
      });

      return files.map(file => this.mapToEntity(file));
    });
  }

  async save(file: File): Promise<File> {
    return this.executeWithErrorHandling('save', async () => {
      const fileData = await this.client.file.create({
        data: {
          id: file.id,
          filename: file.filename,
          originalName: file.originalName,
          path: file.path,
          objectKey: file.getObjectKeyString(),
          mimeType: file.mimeType,
          size: file.size.getBytes(),
          bucket: file.bucket,
          userId: file.userId,
          isPublic: file.isPublic,
          status: file.status.toString() as $Enums.FileStatus,
          uploadId: file.getUploadIdString(),
          etag: file.getETagString(),
          targetApps: file.targetApps,
        },
      });

      return this.mapToEntity(fileData);
    });
  }

  async update(file: File): Promise<File> {
    return this.executeWithErrorHandling('update', async () => {
      const fileData = await this.client.file.update({
        where: { id: file.id },
        data: {
          filename: file.filename,
          originalName: file.originalName,
          path: file.path,
          objectKey: file.objectKey.toString(),
          mimeType: file.mimeType,
          size: file.getSizeInBytes(),
          bucket: file.bucket,
          isPublic: file.isPublic,
          status: file.status.toString() as $Enums.FileStatus,
          uploadId: file.getUploadIdString(),
          etag: file.getETagString(),
          targetApps: file.targetApps,
          updatedAt: file.updatedAt,
        },
      });

      return this.mapToEntity(fileData);
    });
  }

  async delete(id: string): Promise<void> {
    return this.executeWithErrorHandling('delete', async () => {
      await this.client.file.delete({
        where: { id },
      });
    });
  }

  async findByObjectKey(bucket: string, objectKey: string): Promise<File | null> {
    return this.executeWithErrorHandling('findByObjectKey', async () => {
      const fileData = await this.client.file.findFirst({
        where: { 
          bucket,
          objectKey 
        },
      });

      return fileData ? this.mapToEntity(fileData) : null;
    });
  }

  async updateObjectKeysByPrefix(userId: string, oldPrefix: string, newPrefix: string): Promise<number> {
    return this.executeWithErrorHandling('updateObjectKeysByPrefix', async () => {
      const result = await this.client.$executeRawUnsafe(
        `UPDATE "File" SET "objectKey" = REPLACE("objectKey", $1, $2) WHERE "userId" = $3 AND "objectKey" LIKE $4`,
        oldPrefix,
        newPrefix,
        userId,
        `${oldPrefix}%`
      );

      return Number(result);
    });
  }

  async findByUploadId(uploadId: string): Promise<File | null> {
    return this.executeWithErrorHandling('findByUploadId', async () => {
      const fileData = await this.client.file.findFirst({
        where: { uploadId },
      });

      return fileData ? this.mapToEntity(fileData) : null;
    });
  }

  async findUploadingFilesByUserId(userId: string): Promise<File[]> {
    return this.executeWithErrorHandling('findUploadingFilesByUserId', async () => {
      const files = await this.client.file.findMany({
        where: { 
          userId,
          status: $Enums.FileStatus.UPLOADING
        },
        orderBy: { createdAt: 'desc' },
      });

      return files.map(file => this.mapToEntity(file));
    });
  }

  async getUserUsedBytes(userId: string): Promise<number> {
    return this.executeWithErrorHandling('getUserUsedBytes', async () => {
      const result = await this.client.file.aggregate({
        where: { 
          userId,
          status: $Enums.FileStatus.UPLOADED
        },
        _sum: {
          size: true
        }
      });

      return result._sum.size || 0;
    });
  }

  async getUserActiveUploadsCount(userId: string): Promise<number> {
    return this.executeWithErrorHandling('getUserActiveUploadsCount', async () => {
      const count = await this.client.file.count({
        where: { 
          userId,
          status: {
            in: [$Enums.FileStatus.UPLOADING, $Enums.FileStatus.PENDING]
          }
        },
      });

      return count;
    });
  }

  async findByBucketAndPrefix(bucket: string, prefix: string): Promise<File[]> {
    return this.executeWithErrorHandling('findByBucketAndPrefix', async () => {
      const files = await this.client.file.findMany({
        where: { 
          bucket,
          path: {
            startsWith: prefix
          }
        },
        orderBy: { createdAt: 'desc' },
      });

      return files.map(file => this.mapToEntity(file));
    });
  }

  async deleteByIds(ids: string[]): Promise<void> {
    return this.executeWithErrorHandling('deleteByIds', async () => {
      await this.client.file.deleteMany({
        where: {
          id: {
            in: ids
          }
        }
      });
    });
  }

  async deleteFilesByPrefix(pathPrefix: string, companyId: string): Promise<number> {
    return this.executeWithErrorHandling('deleteFilesByPrefix', async () => {
      const result = await this.client.file.deleteMany({
        where: {
          path: {
            startsWith: pathPrefix
          },
          user: {
            companyId: companyId
          }
        }
      });
      
      return result.count;
    });
  }

  async updateStatus(id: string, status: FileStatus): Promise<void> {
    return this.executeWithErrorHandling('updateStatus', async () => {
      await this.client.file.update({
        where: { id },
        data: {
          status: status.toString() as $Enums.FileStatus
        }
      });
    });
  }

  async updateUploadId(id: string, uploadId: string | null): Promise<void> {
    return this.executeWithErrorHandling('updateUploadId', async () => {
      await this.client.file.update({
        where: { id },
        data: {
          uploadId
        }
      });
    });
  }

  async updateETag(id: string, etag: string | null): Promise<void> {
    return this.executeWithErrorHandling('updateETag', async () => {
      await this.client.file.update({
        where: { id },
        data: {
          etag
        }
      });
    });
  }

  async findExpiredUploads(olderThanMinutes: number): Promise<File[]> {
    return this.executeWithErrorHandling('findExpiredUploads', async () => {
      const expiredTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);
      const files = await this.client.file.findMany({
        where: { 
          status: {
            in: [$Enums.FileStatus.UPLOADING, $Enums.FileStatus.PENDING]
          },
          updatedAt: {
            lt: expiredTime
          }
        },
        orderBy: { updatedAt: 'desc' },
      });

      return files.map(file => this.mapToEntity(file));
    });
  }


  async findByCompanyIdAndFilters(params: {
    companyId: string;
    pathPrefix?: string;
    status?: string;
    mimeType?: string;
    page: number;
    limit: number;
  }): Promise<File[]> {
    const { companyId, pathPrefix, status, mimeType, page, limit } = params;

    return this.executeWithErrorHandling('findByCompanyIdAndFilters', async () => {
      const whereClause: any = {
        user: {
          companyId: companyId,
        },
      };

      if (pathPrefix) {
        whereClause.path = {
          startsWith: pathPrefix,
        };
      }

      if (status) {
        whereClause.status = status;
      }

      if (mimeType) {
        whereClause.mimeType = {
          startsWith: mimeType,
        };
      }

      const files = await this.client.file.findMany({
        where: whereClause,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      });

      return files.map(file => this.mapToEntity(file));
    });
  }

  private mapToEntity(fileData: IFileData): File {
    return File.fromPersistence({
      id: fileData.id,
      filename: fileData.filename,
      originalName: fileData.originalName,
      path: fileData.path,
      objectKey: fileData.objectKey || `${fileData.path}/${fileData.filename}`,
      mimeType: fileData.mimeType,
      size: fileData.size,
      bucket: fileData.bucket,
      userId: fileData.userId,
      isPublic: fileData.isPublic,
      status: fileData.status,
      uploadId: fileData.uploadId,
      etag: fileData.etag,
      targetApps: fileData.targetApps || [],
      createdAt: fileData.createdAt,
      updatedAt: fileData.updatedAt,
    });
  }
}
