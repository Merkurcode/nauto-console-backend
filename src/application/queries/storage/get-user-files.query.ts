import { Injectable, Inject } from '@nestjs/common';
import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { IGetUserFilesResponse } from '@application/dtos/_responses/storage/storage.response.interface';
import { EnhancedFileMapper } from '@application/mappers/enhanced-file.mapper';
import { File } from '@core/entities/file.entity';
import { FileStatus } from '@core/value-objects/file-status.vo';
import { FILE_REPOSITORY } from '@shared/constants/tokens';
import { InvalidParameterException } from '@core/exceptions/domain-exceptions';
import { FileAccessControlService } from '@core/services/file-access-control.service';

export class GetUserFilesQuery implements IQuery {
  constructor(
    public readonly userId: string,
    public readonly status?: string,
    public readonly path?: string,
    public readonly limit?: string,
    public readonly offset?: string,
  ) {}
}

@Injectable()
@QueryHandler(GetUserFilesQuery)
export class GetUserFilesHandler
  implements IQueryHandler<GetUserFilesQuery, IGetUserFilesResponse>
{
  constructor(
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    private readonly fileAccessControlService: FileAccessControlService,
    private readonly enhancedFileMapper: EnhancedFileMapper,
  ) {}

  async execute(query: GetUserFilesQuery): Promise<IGetUserFilesResponse> {
    const { userId, status, path } = query;

    // Validate and parse limit
    let limit = 20; // default
    if (query.limit) {
      const parsedLimit = parseInt(query.limit, 10);
      if (isNaN(parsedLimit)) {
        throw new InvalidParameterException('limit', query.limit, 'Must be a valid number');
      }
      limit = parsedLimit;
    }

    // Validate and parse offset
    let offset = 0; // default
    if (query.offset) {
      const parsedOffset = parseInt(query.offset, 10);
      if (isNaN(parsedOffset)) {
        throw new InvalidParameterException('offset', query.offset, 'Must be a valid number');
      }
      offset = parsedOffset;
    }

    // Set pagination limits
    const maxLimit = 100;
    const finalLimit = Math.min(Math.max(1, limit), maxLimit);
    const finalOffset = Math.max(0, offset);

    let files: File[];
    let total: number;

    if (status) {
      // Filter by specific status with pagination
      const fileStatus = FileStatus.fromString(status);
      const result = await this.fileRepository.findByUserIdAndStatusPaginated(
        userId,
        fileStatus,
        finalLimit,
        finalOffset,
      );
      files = result.files;
      total = result.total;
    } else {
      // Get all files for user with pagination
      const result = await this.fileRepository.findByUserIdPaginated(
        userId,
        finalLimit,
        finalOffset,
      );
      files = result.files;
      total = result.total;
    }

    // Filter by path if provided (apply after pagination for now)
    // Note: For optimal performance, path filtering should be moved to the database query
    if (path) {
      files = files.filter(file => file.path.startsWith(path));
      // Adjust total count when path filtering is applied
      if (path && finalOffset === 0) {
        // Only adjust total on first page to avoid complexity
        total = files.length;
      }
    }

    // Apply access control to each file - filter out files user cannot access
    const userPayload = { sub: userId };
    const accessibleFiles = files.filter(file => {
      try {
        this.fileAccessControlService.validateFileAccess(file, userPayload, 'read');

        return true;
      } catch {
        return false; // Skip files user cannot access
      }
    });

    const currentPage = Math.floor(finalOffset / finalLimit) + 1;
    const hasNext = finalOffset + accessibleFiles.length < total;
    const hasPrev = finalOffset > 0;

    const filesWithSignedUrls =
      await this.enhancedFileMapper.toResponseArrayWithSignedUrls(accessibleFiles);

    return {
      files: filesWithSignedUrls,
      total: total,
      page: currentPage,
      limit: finalLimit,
      hasNext,
      hasPrev,
    };
  }
}
