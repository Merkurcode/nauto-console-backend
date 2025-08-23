import { Injectable, Inject } from '@nestjs/common';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { FILE_REPOSITORY } from '@shared/constants/tokens';
import { StoragePaths } from '@core/utils/storage-paths';

export interface IUniqueFileNameResult {
  filename: string;
  objectKey: string;
  isRenamed: boolean;
  originalName: string;
}

/**
 * Service to handle file naming conflicts like Dropbox
 *
 * Examples:
 * - document.pdf -> document.pdf (if unique)
 * - document.pdf -> document (1).pdf (if duplicate)
 * - document.pdf -> document (2).pdf (if document (1).pdf exists)
 */
@Injectable()
export class FileNamingService {
  constructor(
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
  ) {}

  /**
   * Generates a unique filename for the given path, handling duplicates like Dropbox
   */
  async generateUniqueFileName(
    originalFilename: string,
    storagePath: string,
    bucket: string,
  ): Promise<IUniqueFileNameResult> {
    const baseObjectKey = StoragePaths.createObjectKey(storagePath, originalFilename);

    // Check if the original name is available
    const existingFile = await this.fileRepository.findByObjectKey(bucket, baseObjectKey);

    if (!existingFile) {
      return {
        filename: originalFilename,
        objectKey: baseObjectKey,
        isRenamed: false,
        originalName: originalFilename,
      };
    }

    // File exists, need to find a unique name
    const { name, extension } = this.parseFilename(originalFilename);
    let counter = 1;
    let uniqueFilename: string;
    let uniqueObjectKey: string;

    do {
      uniqueFilename = this.formatConflictFilename(name, counter, extension);
      uniqueObjectKey = StoragePaths.createObjectKey(storagePath, uniqueFilename);

      const conflictingFile = await this.fileRepository.findByObjectKey(bucket, uniqueObjectKey);

      if (!conflictingFile) {
        break;
      }

      counter++;

      // Safety limit to prevent infinite loops
      if (counter > 1000) {
        // Fallback to timestamp-based naming
        const timestamp = Date.now();
        uniqueFilename = `${name}_${timestamp}${extension}`;
        uniqueObjectKey = StoragePaths.createObjectKey(storagePath, uniqueFilename);
        break;
      }
    } while (true);

    return {
      filename: uniqueFilename,
      objectKey: uniqueObjectKey,
      isRenamed: true,
      originalName: originalFilename,
    };
  }

  /**
   * Parses filename into name and extension
   * Examples:
   * - "document.pdf" -> { name: "document", extension: ".pdf" }
   * - "archive.tar.gz" -> { name: "archive.tar", extension: ".gz" }
   * - "README" -> { name: "README", extension: "" }
   */
  private parseFilename(filename: string): { name: string; extension: string } {
    const lastDotIndex = filename.lastIndexOf('.');

    if (lastDotIndex === -1 || lastDotIndex === 0) {
      // No extension or hidden file
      return { name: filename, extension: '' };
    }

    return {
      name: filename.substring(0, lastDotIndex),
      extension: filename.substring(lastDotIndex),
    };
  }

  /**
   * Formats filename with conflict number like Dropbox
   * Examples:
   * - formatConflictFilename("document", 1, ".pdf") -> "document (1).pdf"
   * - formatConflictFilename("README", 2, "") -> "README (2)"
   */
  private formatConflictFilename(name: string, counter: number, extension: string): string {
    return `${name} (${counter})${extension}`;
  }

  /**
   * Extracts the original filename from a conflict-renamed file
   * Examples:
   * - "document (1).pdf" -> "document.pdf"
   * - "README (3)" -> "README"
   */
  getOriginalFilename(conflictFilename: string): string {
    // Pattern: name (number).extension
    const conflictPattern = /^(.+?)\s+\(\d+\)(.*)$/;
    const match = conflictFilename.match(conflictPattern);

    if (match) {
      const [, name, extension] = match;

      return `${name}${extension}`;
    }

    return conflictFilename;
  }

  /**
   * Gets the conflict number from a renamed file
   * Examples:
   * - "document (1).pdf" -> 1
   * - "README (3)" -> 3
   * - "document.pdf" -> null (not a conflict file)
   */
  getConflictNumber(filename: string): number | null {
    const conflictPattern = /^.+?\s+\((\d+)\).*$/;
    const match = filename.match(conflictPattern);

    return match ? parseInt(match[1], 10) : null;
  }
}
