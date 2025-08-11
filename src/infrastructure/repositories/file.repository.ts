/* eslint-disable prettier/prettier */
import { Injectable, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { TransactionContextService } from '../database/prisma/transaction-context.service';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { File } from '@core/entities/file.entity';
import { BaseRepository } from './base.repository';
import { FileStatus } from '@shared/constants/file-status.enum';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';

/**
 * Interface representing file data from storage
 */
export interface IFileData {
  id: string;
  filename: string;
  originalName: string;
  path: string;
  mimeType: string;
  size: number;
  bucket: string;
  userId: string;
  isPublic: boolean;
  status: string;
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

  async findByUserIdAndStatusIn(userId: string, statuses: string[]): Promise<File[]> {
    return this.executeWithErrorHandling('findByUserIdAndStatusIn', async () => {
      const files = await this.client.file.findMany({
        where: { 
          userId,
          status: {
            in: statuses as FileStatus[]
          }
        },
        orderBy: { createdAt: 'desc' },
      });

      return files.map(file => this.mapToEntity(file));
    });
  }

  async findByPath(path: string): Promise<File | null> {
    return this.executeWithErrorHandling('findByPath', async () => {
      const fileData = await this.client.file.findFirst({
        where: { path },
      });

      return fileData ? this.mapToEntity(fileData) : null;
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
          mimeType: file.mimeType,
          size: file.size,
          bucket: file.bucket,
          userId: file.userId,
          isPublic: file.isPublic,
          status: file.status.toString() as FileStatus,
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
          isPublic: file.isPublic,
          status: file.status.toString() as FileStatus,
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

  private mapToEntity(fileData: IFileData): File {
    return File.fromData({
      id: fileData.id,
      filename: fileData.filename,
      originalName: fileData.originalName,
      path: fileData.path,
      mimeType: fileData.mimeType,
      size: fileData.size,
      bucket: fileData.bucket,
      userId: fileData.userId,
      isPublic: fileData.isPublic,
      status: fileData.status,
      createdAt: fileData.createdAt,
      updatedAt: fileData.updatedAt,
    });
  }
}
