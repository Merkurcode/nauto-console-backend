import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { IStorageService } from '@core/repositories/storage.service.interface';
import { File } from '@core/entities/file.entity';
import { FileAccessControlService } from '@core/services/file-access-control.service';
import { FILE_REPOSITORY, STORAGE_SERVICE } from '@shared/constants/tokens';
import { InvalidParameterException } from '@core/exceptions/domain-exceptions';
import {
  IDirectoryContentsResponse,
  IDirectoryItem,
} from '@application/dtos/_responses/storage/storage.response.interface';
import { StorageAreaType } from '@shared/types/storage-areas.types';

export class GetCommonDirectoryContentsQuery implements IQuery {
  constructor(
    public readonly userId: string,
    public readonly companyId: string,
    public readonly area: StorageAreaType,
    public readonly path: string = '',
    public readonly limit?: string,
    public readonly offset?: string,
    public readonly includePhysical?: string,
  ) {}
}

@Injectable()
@QueryHandler(GetCommonDirectoryContentsQuery)
export class GetCommonDirectoryContentsHandler
  implements IQueryHandler<GetCommonDirectoryContentsQuery, IDirectoryContentsResponse>
{
  constructor(
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,

    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,

    private readonly fileAccessControlService: FileAccessControlService,
    private readonly configService: ConfigService,
  ) {}

  async execute(query: GetCommonDirectoryContentsQuery): Promise<IDirectoryContentsResponse> {
    const { userId, companyId, area, path, includePhysical } = query;

    // Store current user ID and company ID for access control in helper methods
    this.currentUserId = userId;
    this.currentCompanyId = companyId;

    // Parse includePhysical parameter (default: true)
    const shouldIncludePhysical = includePhysical !== 'false';

    // Parse pagination parameters
    const limit = this.parseLimit(query.limit);
    const offset = this.parseOffset(query.offset);

    // Normalize path - ensure it doesn't start with / but can be empty
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;

    // Build full storage path for common area files
    const fullStoragePath = this.buildCommonStoragePath(companyId, area, normalizedPath);
    const bucket = this.configService.get<string>('storage.defaultBucket', 'nauto-console-dev');

    // Get all items in this directory
    const items: IDirectoryItem[] = [];

    // 1. Get folders from both storage (physical) and database (virtual via file paths)
    const folders = await this.getCombinedFoldersInPath(bucket, fullStoragePath);

    items.push(
      ...folders.map(folderPath => ({
        name: this.extractFolderName(folderPath),
        type: 'folder' as const,
        path: this.stripCommonPrefixFromPath(folderPath, companyId, area),
      })),
    );

    // 2. Get combined files from both database and physical storage
    const combinedFiles = await this.getCombinedFilesInPath(
      bucket,
      fullStoragePath,
      shouldIncludePhysical,
    );

    items.push(...combinedFiles);

    // Sort items: folders first, then files, both alphabetically
    items.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }

      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    // Apply pagination
    const total = items.length;
    const paginatedItems = items.slice(offset, offset + limit);

    const currentPage = Math.floor(offset / limit) + 1;
    const hasNext = offset + paginatedItems.length < total;
    const hasPrev = offset > 0;

    return {
      items: paginatedItems,
      currentPath: normalizedPath,
      total,
      page: currentPage,
      limit,
      hasNext,
      hasPrev,
    };
  }

  private parseLimit(limitStr?: string): number {
    const defaultLimit = 50;
    const maxLimit = 200;

    if (!limitStr) return defaultLimit;

    const parsed = parseInt(limitStr, 10);
    if (isNaN(parsed)) {
      throw new InvalidParameterException('limit', limitStr, 'Must be a valid number');
    }

    return Math.min(Math.max(1, parsed), maxLimit);
  }

  private parseOffset(offsetStr?: string): number {
    if (!offsetStr) return 0;

    const parsed = parseInt(offsetStr, 10);
    if (isNaN(parsed)) {
      throw new InvalidParameterException('offset', offsetStr, 'Must be a valid number');
    }

    return Math.max(0, parsed);
  }

  private buildCommonStoragePath(companyId: string, area: string, path: string): string {
    const basePath = `${companyId}/common/${area}`;

    return path ? `${basePath}/${path}` : basePath;
  }

  private async getCombinedFoldersInPath(bucket: string, basePath: string): Promise<string[]> {
    const folderSet = new Set<string>();

    // 1. Get physical folders from storage
    const physicalFolders = await this.getPhysicalFoldersInPath(bucket, basePath);
    physicalFolders.forEach(folder => folderSet.add(folder));

    // 2. Get virtual folders from file paths in database
    const virtualFolders = await this.getVirtualFoldersInPath(basePath);
    virtualFolders.forEach(folder => folderSet.add(folder));

    return Array.from(folderSet);
  }

  private async getPhysicalFoldersInPath(bucket: string, basePath: string): Promise<string[]> {
    try {
      // Ensure basePath ends with / for proper prefix matching
      const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;

      // Try to use the new V2 method if available
      if (this.storageService.listObjectsV2) {
        const { prefixes } = await this.storageService.listObjectsV2(bucket, normalizedBasePath);

        // Convert prefixes to folder paths (remove trailing slash for consistency)
        const folderSet = new Set<string>();
        for (const prefix of prefixes) {
          // Remove trailing slash if present
          const cleanPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
          folderSet.add(cleanPrefix);
        }

        return Array.from(folderSet);
      }

      // Fallback to old method
      const allObjects = await this.storageService.listObjectsByPrefix(bucket, normalizedBasePath);

      // Extract unique folder paths at the current level only
      const folderSet = new Set<string>();

      for (const objectKey of allObjects) {
        // Remove the base path to get relative path
        const relativePath = objectKey.replace(normalizedBasePath, '');

        // Skip empty paths
        if (!relativePath) continue;

        // Check if this is a direct folder marker (ends with /, no more slashes)
        if (relativePath.endsWith('/') && !relativePath.slice(0, -1).includes('/')) {
          // This is a folder marker at this level (like "documents/")
          const folderName = relativePath.slice(0, -1);
          folderSet.add(`${normalizedBasePath}${folderName}`);
          continue;
        }

        // Check if this is a file/object inside a subdirectory
        if (relativePath.includes('/')) {
          // Get the first folder in the path
          const firstFolder = relativePath.split('/')[0];
          if (firstFolder) {
            folderSet.add(`${normalizedBasePath}${firstFolder}`);
          }
        }
      }

      return Array.from(folderSet);
    } catch (error) {
      // If storage listing fails, return empty array
      console.warn('Failed to list physical folders from storage:', error);

      return [];
    }
  }

  private async getVirtualFoldersInPath(basePath: string): Promise<string[]> {
    try {
      // Get bucket for the search
      const bucket = this.configService.get<string>('storage.defaultBucket', 'nauto-console-dev');

      // Get all files that have object keys starting with basePath
      const pathPrefix = basePath.endsWith('/') ? basePath : `${basePath}/`;
      const allFiles = await this.fileRepository.findByBucketAndPrefix(bucket, pathPrefix);

      const folderSet = new Set<string>();

      for (const file of allFiles) {
        // Skip files that are exactly in this path (no subfolders)
        if (file.path === basePath) continue;

        // Check if file is in a direct subfolder of basePath
        if (file.path.startsWith(pathPrefix)) {
          const relativePath = file.path.replace(pathPrefix, '');

          // If there are more slashes, this file is in a subfolder
          if (relativePath.includes('/')) {
            const firstFolder = relativePath.split('/')[0];
            if (firstFolder) {
              folderSet.add(`${pathPrefix}${firstFolder}`);
            }
          }
        }
      }

      return Array.from(folderSet);
    } catch (error) {
      console.warn('Failed to get virtual folders from database:', error);

      return [];
    }
  }

  private async getFilesInPath(storagePath: string): Promise<File[]> {
    try {
      // Get files that are in this exact path (not subdirectories)
      const allFiles = await this.fileRepository.findByPath(storagePath);

      // Filter to only files in the exact path
      return allFiles.filter(file => file.path === storagePath);
    } catch (error) {
      console.warn('Failed to get files from database:', error);

      return [];
    }
  }

  private extractFolderName(folderPath: string): string {
    const parts = folderPath.split('/');

    return parts[parts.length - 1] || parts[parts.length - 2];
  }

  private stripCommonPrefixFromPath(fullPath: string, companyId: string, area: string): string {
    const prefix = `${companyId}/common/${area}/`;

    return fullPath.startsWith(prefix) ? fullPath.slice(prefix.length) : fullPath;
  }

  private async getCombinedFilesInPath(
    bucket: string,
    fullStoragePath: string,
    includePhysical: boolean = true,
  ): Promise<IDirectoryItem[]> {
    const fileItems: IDirectoryItem[] = [];

    // 1. Get files from database that are in this exact path
    const dbFiles = await this.getFilesInPath(fullStoragePath);

    // Apply access control to database files
    const userPayload = { sub: this.currentUserId };
    const accessibleDbFiles = dbFiles.filter(file => {
      try {
        this.fileAccessControlService.validateFileAccess(file, userPayload, 'read');

        return true;
      } catch {
        // In common areas, show files from same company even if not directly accessible
        // This ensures files uploaded by other users in the company are visible
        const userCompanyId = this.extractCompanyIdFromQuery();
        const fileCompanyId = this.extractCompanyIdFromPath(file.path);

        return userCompanyId && fileCompanyId && userCompanyId === fileCompanyId;
      }
    });

    // Add database files to items with signed URLs
    const dbFileItems = await Promise.all(
      accessibleDbFiles.map(async file => {
        const item: IDirectoryItem = {
          id: file.id,
          name: file.filename,
          type: 'file' as const,
          path: file.path,
          size: file.getSizeInBytes(),
          mimeType: file.mimeType,
          createdAt: file.createdAt,
          updatedAt: file.updatedAt,
          status: file.status.getValue(),
        };

        // Add signed URL for all uploaded files in common areas
        if (file.status.isUploaded()) {
          try {
            const maxExpiryHours = this.configService.get<number>(
              'storage.presign.maxExpiryHours',
              24,
            );
            const expirationSeconds = maxExpiryHours * 3600;

            const { url } = await this.storageService.generatePresignedGetUrl(
              file.bucket,
              file.objectKey.toString(),
              expirationSeconds,
            );

            const expiresAt = new Date(Date.now() + expirationSeconds * 1000);
            item.signedUrl = url;
            item.signedUrlExpiresAt = expiresAt;
          } catch (error) {
            // If signed URL generation fails, file is returned without signed URL
            console.warn(`Failed to generate signed URL for file ${file.id}:`, error);
          }
        }

        return item;
      }),
    );

    fileItems.push(...dbFileItems);

    // 2. Get physical files from MinIO that are NOT in database (only if requested)
    if (includePhysical) {
      const physicalFiles = await this.getPhysicalFilesNotInDatabase(
        bucket,
        fullStoragePath,
        dbFiles, // Pass ALL database files, not just accessible ones, to properly exclude them from PHYSICAL_ONLY
      );
      fileItems.push(...physicalFiles);
    }

    return fileItems;
  }

  private async getPhysicalFilesNotInDatabase(
    bucket: string,
    fullStoragePath: string,
    dbFiles: File[],
  ): Promise<IDirectoryItem[]> {
    try {
      // Ensure fullStoragePath ends with / for proper prefix matching
      const normalizedBasePath = fullStoragePath.endsWith('/')
        ? fullStoragePath
        : `${fullStoragePath}/`;

      // Get all objects in this directory
      const allObjects = await this.storageService.listObjectsByPrefix(bucket, normalizedBasePath);

      // Create set of filenames already in database
      const dbFilenames = new Set(dbFiles.map(file => file.filename));

      const physicalFileItems: IDirectoryItem[] = [];

      for (const objectKey of allObjects) {
        // Remove the base path to get relative path
        const relativePath = objectKey.replace(normalizedBasePath, '');

        // Skip if this is not a direct file (has subdirectories) or is empty
        if (!relativePath || relativePath.includes('/') || relativePath.endsWith('/')) {
          continue;
        }

        // Skip if this file is already in the database
        if (dbFilenames.has(relativePath)) {
          continue;
        }

        // This is a physical-only file, add it to the list
        try {
          const metadata = await this.storageService.getObjectMetadata(bucket, objectKey);

          // Physical files don't get signed URLs since they don't have UPLOADED status
          physicalFileItems.push({
            name: relativePath,
            type: 'file' as const,
            path: fullStoragePath,
            size: metadata.size,
            mimeType: metadata.contentType || 'application/octet-stream',
            createdAt: metadata.lastModified,
            updatedAt: metadata.lastModified,
            status: 'PHYSICAL_ONLY', // Special status for files not in database
          });
        } catch (error) {
          console.warn(`Failed to get metadata for physical file ${objectKey}:`, error);
        }
      }

      return physicalFileItems;
    } catch (error) {
      console.warn('Failed to get physical files from storage:', error);

      return [];
    }
  }

  // Store current user ID and company ID for access control
  private currentUserId?: string;
  private currentCompanyId?: string;

  private extractCompanyIdFromQuery(): string | null {
    return this.currentCompanyId || null;
  }

  private extractCompanyIdFromPath(filePath: string): string | null {
    // Path format: companyId/common/area/... or companyId/users/userId/...
    const pathSegments = filePath.split('/');

    return pathSegments.length > 0 ? pathSegments[0] : null;
  }
}
