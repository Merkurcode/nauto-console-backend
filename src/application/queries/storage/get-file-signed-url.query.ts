import { Injectable, Inject } from '@nestjs/common';
import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { FileOperationsService } from '@core/services/file-operations.service';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { FILE_REPOSITORY } from '@shared/constants/tokens';
import {
  EntityNotFoundException,
  InvalidParameterException,
} from '@core/exceptions/domain-exceptions';
import { FileAccessControlService } from '@core/services/file-access-control.service';
import { IGetFileSignedUrlResponse } from '@application/dtos/_responses/storage/storage.response.interface';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';

export class GetFileSignedUrlQuery implements IQuery {
  constructor(
    public readonly fileId: string,
    public readonly expirationSeconds?: string,
    public readonly user?: IJwtPayload | string | any, // For access control - flexible user type
  ) {}
}

@Injectable()
@QueryHandler(GetFileSignedUrlQuery)
export class GetFileSignedUrlHandler
  implements IQueryHandler<GetFileSignedUrlQuery, IGetFileSignedUrlResponse>
{
  constructor(
    private readonly fileOperationsService: FileOperationsService,
    private readonly configService: ConfigService,
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    private readonly fileAccessControlService: FileAccessControlService,
  ) {}

  async execute(query: GetFileSignedUrlQuery): Promise<IGetFileSignedUrlResponse> {
    const { fileId, expirationSeconds, user } = query;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(fileId)) {
      throw new InvalidParameterException('fileId', fileId, 'Must be a valid UUID');
    }

    const defaultExpiry = this.configService.get<number>('storage.presign.expirySec', 3600);
    let expiry = defaultExpiry;

    // Validate expiration seconds if provided
    if (expirationSeconds) {
      expiry = parseInt(expirationSeconds, 10);
      if (isNaN(expiry)) {
        throw new InvalidParameterException(
          'expirationSeconds',
          expirationSeconds,
          'Must be a valid number',
        );
      }

      // Validate expiration limits
      const maxSeconds =
        this.configService.get<number>('storage.presign.maxExpiryHours', 24) * 3600;
      const minSeconds = this.configService.get<number>('storage.presign.minExpirySeconds', 60);

      if (expiry < minSeconds || expiry > maxSeconds) {
        throw new InvalidParameterException(
          'expirationSeconds',
          expiry.toString(),
          `Must be between ${minSeconds} and ${maxSeconds} seconds`,
        );
      }
    }

    // Get file and validate access
    const file = await this.fileRepository.findById(fileId);
    if (!file) {
      throw new EntityNotFoundException('File', fileId);
    }

    // Handle both user object and string userId for backward compatibility
    const userPayload = typeof user === 'string' ? { sub: user } : user;

    // Validate file access using business rules
    this.fileAccessControlService.validateFileAccess(file, userPayload, 'read');

    const url = await this.fileOperationsService.generateSignedUrl({
      fileId,
      expirationSeconds: expiry,
      userId: typeof user === 'string' ? user : user?.sub,
      userPayload: typeof user === 'string' ? { sub: user } : user,
    });

    return {
      url,
      expirationSeconds: expiry,
      isPublic: file.isPublic,
    };
  }
}
