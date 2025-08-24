import { Injectable, Inject } from '@nestjs/common';
import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { FileResponseDto } from '@application/dtos/_responses/storage/storage.swagger.dto';
import { EnhancedFileMapper } from '@application/mappers/enhanced-file.mapper';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';
import { FILE_REPOSITORY } from '@shared/constants/tokens';
import { FileAccessControlService } from '@core/services/file-access-control.service';

export class GetFileQuery implements IQuery {
  constructor(
    public readonly fileId: string,
    public readonly userId?: string, // For access control
  ) {}
}

@Injectable()
@QueryHandler(GetFileQuery)
export class GetFileHandler
  implements
    IQueryHandler<GetFileQuery, FileResponseDto & { signedUrl?: string; signedUrlExpiresAt?: Date }>
{
  constructor(
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    private readonly fileAccessControlService: FileAccessControlService,
    private readonly enhancedFileMapper: EnhancedFileMapper,
  ) {}

  async execute(
    query: GetFileQuery,
  ): Promise<FileResponseDto & { signedUrl?: string; signedUrlExpiresAt?: Date }> {
    const { fileId, userId } = query;

    const file = await this.fileRepository.findById(fileId);
    if (!file) {
      throw new EntityNotFoundException('File', fileId);
    }

    // Validate file access using business rules
    const userPayload = userId ? { sub: userId } : null;
    this.fileAccessControlService.validateFileAccess(file, userPayload, 'read');

    // Return file details with signed URL (only for uploaded files)
    return this.enhancedFileMapper.toResponseWithSignedUrl(file);
  }
}
