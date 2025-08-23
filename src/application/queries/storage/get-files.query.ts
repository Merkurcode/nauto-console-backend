import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { FILE_REPOSITORY } from '@shared/constants/tokens';
import { EnhancedFileMapper } from '@application/mappers/enhanced-file.mapper';
import { CommonFolder } from '@shared/types/storage-areas.types';
import { StoragePaths } from '@core/utils/storage-paths';
import { StorageAreaUtils } from '@shared/utils/storage-area.utils';

export interface IGetFilesResponse {
  files: Array<{
    id: string;
    filename: string;
    originalName: string;
    path: string;
    size: number;
    mimeType: string;
    status: string;
    isPublic: boolean;
    createdAt: Date;
    updatedAt: Date;
    signedUrl?: string;
    signedUrlExpiresAt?: Date;
  }>;
  total: number;
  page: number;
  limit: number;
}

export class GetFilesQuery implements IQuery {
  constructor(
    public readonly userId: string,
    public readonly companyId: string,
    public readonly path?: string,
    public readonly status?: string,
    public readonly mimeType?: string,
    public readonly page?: number,
    public readonly limit?: number,
    public readonly isCommonPath?: boolean,
    public readonly commonFolder?: CommonFolder,
  ) {}
}

@Injectable()
@QueryHandler(GetFilesQuery)
export class GetFilesHandler implements IQueryHandler<GetFilesQuery, IGetFilesResponse> {
  constructor(
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    private readonly enhancedFileMapper: EnhancedFileMapper,
  ) {}

  async execute(query: GetFilesQuery): Promise<IGetFilesResponse> {
    const {
      userId,
      companyId,
      path,
      status,
      mimeType,
      page = 1,
      limit = 20,
      isCommonPath,
      commonFolder,
    } = query;

    // Construct storage path prefix for filtering
    let pathPrefix: string;
    if (isCommonPath && commonFolder) {
      pathPrefix = StorageAreaUtils.getStoragePathForCommonFolder(
        commonFolder,
        companyId,
        path || '',
      );
    } else {
      pathPrefix = StoragePaths.forUser(companyId, userId, path || '');
    }

    // Get files with hierarchical path filtering
    const files = await this.fileRepository.findByCompanyIdAndFilters({
      companyId,
      pathPrefix,
      status,
      mimeType,
      page,
      limit,
    });

    // Filter files to ensure user access (additional security layer)
    const accessibleFiles = files.filter(file => {
      // Simple path-based security check
      if (isCommonPath) {
        // Common files accessible to all company users
        return file.path.startsWith(`${companyId}/common/`);
      } else {
        // User files only accessible to owner
        return file.userId === userId && file.path.startsWith(`${companyId}/users/${userId}`);
      }
    });

    const mappedFiles =
      await this.enhancedFileMapper.toResponseArrayWithSignedUrls(accessibleFiles);

    return {
      files: mappedFiles,
      total: accessibleFiles.length,
      page,
      limit,
    };
  }
}
