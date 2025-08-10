import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { StorageService } from '@core/services/storage.service';
import { FileMapper } from '../../mappers/file.mapper';
import { IFileResponse } from '../../dtos/_responses/storage/file.response.interface';

export class GetUserFilesQuery {
  constructor(public readonly userId: string) {}
}

@QueryHandler(GetUserFilesQuery)
export class GetUserFilesQueryHandler implements IQueryHandler<GetUserFilesQuery, IFileResponse[]> {
  constructor(
    private readonly storageService: StorageService,
    private readonly fileMapper: FileMapper,
  ) {}

  async execute(query: GetUserFilesQuery): Promise<IFileResponse[]> {
    const { userId } = query;
    const files = await this.storageService.getFilesByUserId(userId);

    return this.fileMapper.toResponseList(files);
  }
}
