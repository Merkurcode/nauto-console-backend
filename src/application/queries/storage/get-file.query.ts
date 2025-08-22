import { Injectable, Inject } from '@nestjs/common';
import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { FileResponseDto } from '@application/dtos/_responses/storage/storage.swagger.dto';
import { FileMapper } from '@application/mappers/file.mapper';
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
export class GetFileHandler implements IQueryHandler<GetFileQuery, FileResponseDto> {
  constructor(
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    private readonly fileAccessControlService: FileAccessControlService,
  ) {}

  async execute(query: GetFileQuery): Promise<FileResponseDto> {
    const { fileId, userId } = query;

    const file = await this.fileRepository.findById(fileId);
    if (!file) {
      throw new EntityNotFoundException('File', fileId);
    }

    // Validate file access using business rules
    const userPayload = userId ? { sub: userId } : null;
    this.fileAccessControlService.validateFileAccess(file, userPayload, 'read');

    return FileMapper.toResponse(file);
  }
}
