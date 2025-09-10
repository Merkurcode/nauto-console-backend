import { Injectable, Inject } from '@nestjs/common';
import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IUserStorageConfigRepository } from '@core/repositories/user-storage-config.repository.interface';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { UserId } from '@core/value-objects/user-id.vo';
import { UserStorageConfigNotFoundException } from '@core/exceptions/storage-domain.exceptions';
import { USER_STORAGE_CONFIG_REPOSITORY, FILE_REPOSITORY } from '@shared/constants/tokens';

export class GetUserStorageQuotaQuery implements IQuery {
  constructor(public readonly userId: string) {}
}

export interface IGetUserStorageQuotaResponse {
  maxStorageBytes: string; // Using string to handle BigInt serialization
  usedStorageBytes: number;
  availableStorageBytes: string;
  maxSimultaneousFiles: number;
  currentActiveUploads: number;
  allowedFileTypes: string[];
  tierName: string;
  tierLevel: string;
  usagePercentage: number;
}

@Injectable()
@QueryHandler(GetUserStorageQuotaQuery)
export class GetUserStorageQuotaHandler
  implements IQueryHandler<GetUserStorageQuotaQuery, IGetUserStorageQuotaResponse>
{
  constructor(
    @Inject(USER_STORAGE_CONFIG_REPOSITORY)
    private readonly userStorageConfigRepository: IUserStorageConfigRepository,

    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
  ) {}

  async execute(query: GetUserStorageQuotaQuery): Promise<IGetUserStorageQuotaResponse> {
    const { userId } = query;
    const userIdVO = UserId.create(userId);

    // Get user storage configuration with tier info
    const tierInfo = await this.userStorageConfigRepository.getUserTierInfo(userIdVO);
    if (!tierInfo) {
      throw new UserStorageConfigNotFoundException(userId);
    }

    // Get current usage
    const usedBytes = await this.fileRepository.getUserUsedBytes(userId);
    const activeUploads = await this.fileRepository.getUserActiveUploadsCount(userId);

    // Calculate metrics
    const maxBytes = tierInfo.maxStorageBytes;
    const availableBytes = BigInt(Math.max(0, Number(maxBytes) - usedBytes));
    const usagePercentage =
      Number(maxBytes) > 0 ? Math.round((usedBytes / Number(maxBytes)) * 100 * 100) / 100 : 0;

    return {
      maxStorageBytes: maxBytes.toString(),
      usedStorageBytes: usedBytes,
      availableStorageBytes: availableBytes.toString(),
      maxSimultaneousFiles: tierInfo.maxSimultaneousFiles,
      currentActiveUploads: activeUploads,
      allowedFileTypes: Object.keys(tierInfo.allowedFileConfig),
      tierName: tierInfo.tierName,
      tierLevel: tierInfo.tierLevel,
      usagePercentage,
    };
  }
}
