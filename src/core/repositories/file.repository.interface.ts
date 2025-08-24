import { File } from '../entities/file.entity';
import { FileStatus } from '../value-objects/file-status.vo';

/**
 * File repository interface following Clean Architecture patterns
 *
 * This interface defines the contract for file persistence operations,
 * including support for multipart uploads and storage quota management.
 *
 * Implementations:
 * - Production: Prisma/PostgreSQL implementation in infrastructure layer
 */
export interface IFileRepository {
  // Basic CRUD operations
  findById(id: string): Promise<File | null>;
  findByUserId(userId: string): Promise<File[]>;
  findByUserIdAndStatus(userId: string, status: FileStatus): Promise<File[]>;
  findByUserIdAndStatusIn(userId: string, statuses: FileStatus[]): Promise<File[]>;

  // Paginated operations
  findByUserIdPaginated(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ files: File[]; total: number }>;
  findByUserIdAndStatusPaginated(
    userId: string,
    status: FileStatus,
    limit: number,
    offset: number,
  ): Promise<{ files: File[]; total: number }>;
  save(file: File): Promise<File>;
  update(file: File): Promise<File>;
  delete(id: string): Promise<void>;

  // Object key operations
  findByObjectKey(bucket: string, objectKey: string): Promise<File | null>;
  findByPath(path: string): Promise<File[]>;
  findByBucketPathAndFilename(bucket: string, path: string, filename: string): Promise<File[]>;
  updateObjectKeysByPrefix(userId: string, oldPrefix: string, newPrefix: string): Promise<number>;

  // Upload-specific operations
  findByUploadId(uploadId: string): Promise<File | null>;
  findUploadingFilesByUserId(userId: string): Promise<File[]>;

  // Storage quota operations
  getUserUsedBytes(userId: string): Promise<number>;
  getUserActiveUploadsCount(userId: string): Promise<number>;

  // Bulk operations
  findByBucketAndPrefix(bucket: string, prefix: string): Promise<File[]>;
  deleteByIds(ids: string[]): Promise<void>;
  deleteFilesByPrefix(pathPrefix: string, companyId: string): Promise<number>;

  // Company-based hierarchical operations
  findByCompanyIdAndFilters(params: {
    companyId: string;
    pathPrefix?: string;
    status?: string;
    mimeType?: string;
    page: number;
    limit: number;
  }): Promise<File[]>;

  // Status operations
  updateStatus(id: string, status: FileStatus): Promise<void>;
  updateUploadId(id: string, uploadId: string | null): Promise<void>;
  updateETag(id: string, etag: string | null): Promise<void>;

  // Cleanup operations
  findExpiredUploads(olderThanMinutes: number): Promise<File[]>;
}
