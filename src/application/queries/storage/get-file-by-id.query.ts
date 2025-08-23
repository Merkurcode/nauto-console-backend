import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { FILE_REPOSITORY } from '@shared/constants/tokens';
import { FileMapper } from '@application/mappers/file.mapper';
import { HierarchicalPath } from '@core/value-objects/hierarchical-path.vo';

export interface IGetFileByIdResponse {
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
  objectKey: string;
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

    return FileMapper.toResponse(file);
  }
}
