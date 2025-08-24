import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, Injectable } from '@nestjs/common';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { FILE_REPOSITORY } from '@shared/constants/tokens';
import { EnhancedFileMapper } from '@application/mappers/enhanced-file.mapper';
import { FileResponseDto } from '@application/dtos/_responses/storage/storage.swagger.dto';

export class GetAllUserFilesQuery implements IQuery {
  constructor(
    public readonly userId: string,
    public readonly companyId: string,
  ) {}
}

export interface IGetAllUserFilesResponse {
  files: Array<FileResponseDto & { signedUrl?: string; signedUrlExpiresAt?: Date }>;
  totalCount: number;
  totalSize: number;
}

@Injectable()
@QueryHandler(GetAllUserFilesQuery)
export class GetAllUserFilesHandler
  implements IQueryHandler<GetAllUserFilesQuery, IGetAllUserFilesResponse>
{
  constructor(
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    private readonly enhancedFileMapper: EnhancedFileMapper,
  ) {}

  async execute(query: GetAllUserFilesQuery): Promise<IGetAllUserFilesResponse> {
    const { userId, companyId } = query;

    // Get all files for the user regardless of path
    const userFiles = await this.fileRepository.findByUserId(userId);

    // Filter by company
    const filteredFiles = userFiles.filter(file => {
      const matchesCompany = file.path.startsWith(companyId);

      return matchesCompany;
    });

    // Calculate total size
    const totalSize = filteredFiles.reduce((sum, file) => sum + (file.size?.getBytes() || 0), 0);

    // Map to response DTOs with signed URLs (only for uploaded files)
    const mappedFiles = await this.enhancedFileMapper.toResponseArrayWithSignedUrls(filteredFiles);

    return {
      files: mappedFiles,
      totalCount: mappedFiles.length,
      totalSize,
    };
  }
}
