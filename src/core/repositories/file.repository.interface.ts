import { File } from '../entities/file.entity';

/**
 * File repository interface
 *
 * Implementations:
 * - {@link File} - Production Prisma/PostgreSQL implementation
 */
export interface IFileRepository {
  findById(id: string): Promise<File | null>;
  findByUserId(userId: string): Promise<File[]>;
  findByUserIdAndStatusIn(userId: string, statuses: string[]): Promise<File[]>;
  save(file: File): Promise<File>;
  update(file: File): Promise<File>;
  delete(id: string): Promise<void>;
  findByPath(path: string): Promise<File | null>;
}
