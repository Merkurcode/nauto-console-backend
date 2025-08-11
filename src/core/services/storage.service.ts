import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IFileRepository } from '../repositories/file.repository.interface';
import { File } from '../entities/file.entity';
import { FILE_REPOSITORY } from '@shared/constants/tokens';
import { FileStatus } from '@shared/constants/file-status.enum';

export interface IStorageFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface IStorageProvider {
  upload(file: IStorageFile, userId?: string): Promise<File>;
  getSignedUrl(file: File): Promise<string>;
  delete(file: File): Promise<void>;
}

@Injectable()
export class StorageService {
  private provider: IStorageProvider;

  constructor(
    @Inject(FILE_REPOSITORY) private readonly fileRepository: IFileRepository,
    private readonly configService: ConfigService,
  ) {}

  setProvider(provider: IStorageProvider): void {
    this.provider = provider;
  }

  async uploadFile(file: IStorageFile, userId?: string): Promise<File> {
    return this.provider.upload(file, userId);
  }

  async getFileById(id: string): Promise<File | null> {
    return this.fileRepository.findById(id);
  }

  async getFilesByUserId(userId: string): Promise<File[]> {
    return this.fileRepository.findByUserId(userId);
  }

  async deleteFile(id: string): Promise<void> {
    const file = await this.fileRepository.findById(id);
    if (file) {
      // Mark as deleted instead of physically deleting
      file.markAsDeleted();
      await this.fileRepository.update(file);

      // Optionally delete from storage provider
      await this.provider.delete(file);
    }
  }

  async hardDeleteFile(id: string): Promise<void> {
    const file = await this.fileRepository.findById(id);
    if (file) {
      await this.provider.delete(file);
      await this.fileRepository.delete(id);
    }
  }

  async makeFilePublic(id: string): Promise<File | null> {
    const file = await this.fileRepository.findById(id);
    if (file) {
      file.makePublic();

      return this.fileRepository.update(file);
    }

    return null;
  }

  async makeFilePrivate(id: string): Promise<File | null> {
    const file = await this.fileRepository.findById(id);
    if (file) {
      file.makePrivate();

      return this.fileRepository.update(file);
    }

    return null;
  }

  async getFileUrl(id: string): Promise<string | null> {
    const file = await this.fileRepository.findById(id);
    if (!file) {
      return null;
    }

    // Use signed URLs for all files (both public and private)
    // This provides better security and access control
    return this.provider.getSignedUrl(file);
  }

  // File status management methods
  async markFileAsUploading(id: string): Promise<File | null> {
    const file = await this.fileRepository.findById(id);
    if (file) {
      file.markAsUploading();

      return this.fileRepository.update(file);
    }

    return null;
  }

  async markFileAsUploaded(id: string): Promise<File | null> {
    const file = await this.fileRepository.findById(id);
    if (file) {
      file.markAsUploaded();

      return this.fileRepository.update(file);
    }

    return null;
  }

  async markFileAsFailed(id: string): Promise<File | null> {
    const file = await this.fileRepository.findById(id);
    if (file) {
      file.markAsFailed();

      return this.fileRepository.update(file);
    }

    return null;
  }

  async markFileAsCanceled(id: string, reason?: string): Promise<File | null> {
    const file = await this.fileRepository.findById(id);
    if (file) {
      file.markAsCanceled(reason);

      return this.fileRepository.update(file);
    }

    return null;
  }

  async markFileAsPending(id: string): Promise<File | null> {
    const file = await this.fileRepository.findById(id);
    if (file) {
      file.markAsPending();

      return this.fileRepository.update(file);
    }

    return null;
  }

  // Helper methods for queries
  async getActiveFilesByUserId(userId: string): Promise<File[]> {
    return this.fileRepository.findByUserIdAndStatusIn(userId, [
      FileStatus.PENDING,
      FileStatus.UPLOADED,
      FileStatus.UPLOADING,
      FileStatus.FAILED,
    ]);
  }

  async getUploadingFilesByUserId(userId: string): Promise<File[]> {
    const allFiles = await this.fileRepository.findByUserId(userId);

    return allFiles.filter(file => file.status.isUploading());
  }

  async getFileCountByStatus(userId: string): Promise<{
    total: number;
    pending: number;
    uploading: number;
    uploaded: number;
    failed: number;
    canceled: number;
    deleted: number;
  }> {
    const allFiles = await this.fileRepository.findByUserId(userId);

    return {
      total: allFiles.length,
      pending: allFiles.filter(file => file.status.isPending()).length,
      uploading: allFiles.filter(file => file.status.isUploading()).length,
      uploaded: allFiles.filter(file => file.status.isUploaded()).length,
      failed: allFiles.filter(file => file.status.isFailed()).length,
      canceled: allFiles.filter(file => file.status.isCanceled()).length,
      deleted: allFiles.filter(file => file.status.isDeleted()).length,
    };
  }
}
