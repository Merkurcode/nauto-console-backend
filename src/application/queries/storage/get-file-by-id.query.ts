import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { FILE_REPOSITORY } from '@shared/constants/tokens';
import { EnhancedFileMapper } from '@application/mappers/enhanced-file.mapper';
import { HierarchicalPath } from '@core/value-objects/hierarchical-path.vo';
import { FileResponseDto } from '@application/dtos/_responses/storage/storage.swagger.dto';

export interface IGetFileByIdResponse extends FileResponseDto {
  signedUrl?: string;
  signedUrlExpiresAt?: Date;
}

export class GetFileByIdQuery implements IQuery {
  constructor(
    public readonly fileId: string,
    public readonly userId: string,
    public readonly companyId: string,
  ) {}
}

@Injectable()
@QueryHandler(GetFileByIdQuery)
export class GetFileByIdHandler implements IQueryHandler<GetFileByIdQuery, IGetFileByIdResponse> {
  constructor(
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    private readonly enhancedFileMapper: EnhancedFileMapper,
  ) {}

  async execute(query: GetFileByIdQuery): Promise<IGetFileByIdResponse> {
    const { fileId, userId, companyId } = query;

    const file = await this.fileRepository.findById(fileId);
    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Validate access using hierarchical path
    try {
      const filePath = HierarchicalPath.fromPath(file.path);
      if (!filePath.canBeAccessedByUser(userId, companyId)) {
        throw new ForbiddenException('Access denied to this file');
      }
    } catch {
      // If path is not hierarchical, fall back to basic user check
      if (file.userId !== userId) {
        throw new ForbiddenException('Access denied to this file');
      }
    }

    // Return file details with signed URL (only for uploaded files)
    return this.enhancedFileMapper.toResponseWithSignedUrl(file);
  }
}
