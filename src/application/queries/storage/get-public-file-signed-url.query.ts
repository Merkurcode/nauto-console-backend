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

export class GetPublicFileSignedUrlQuery implements IQuery {
  constructor(
    public readonly fileId: string,
    public readonly expirationSeconds?: string,
  ) {}
}

export interface IGetPublicFileSignedUrlResponse {
  url: string;
  expirationSeconds: number;
  isPublic: boolean;
}

@Injectable()
@QueryHandler(GetPublicFileSignedUrlQuery)
export class GetPublicFileSignedUrlHandler
  implements IQueryHandler<GetPublicFileSignedUrlQuery, IGetPublicFileSignedUrlResponse>
{
  constructor(
    private readonly fileOperationsService: FileOperationsService,
    private readonly configService: ConfigService,
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    private readonly fileAccessControlService: FileAccessControlService,
  ) {}

  async execute(query: GetPublicFileSignedUrlQuery): Promise<IGetPublicFileSignedUrlResponse> {
    const { fileId, expirationSeconds } = query;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(fileId)) {
      throw new InvalidParameterException('fileId', fileId, 'Must be a valid UUID');
    }

    // Public file expiration limits (more restrictive than private)
    const defaultExpiry = this.configService.get<number>('storage.presign.expirySec', 3600);
    const maxPublicExpiryHours = 4; // 4 hours max for public URLs
    const minSeconds = 60; // 1 minute
    const maxPublicSeconds = maxPublicExpiryHours * 3600;

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

      // Apply public file limits (more restrictive)
      if (expiry < minSeconds || expiry > maxPublicSeconds) {
        throw new InvalidParameterException(
          'expirationSeconds',
          expiry.toString(),
          `Public file URLs are limited to ${minSeconds}-${maxPublicSeconds} seconds (1 minute to 4 hours)`,
        );
      }
    }

    // Get file and validate public access
    const file = await this.fileRepository.findById(fileId);
    if (!file) {
      throw new EntityNotFoundException('File', fileId);
    }

    // Validate public file access (anonymous user)
    this.fileAccessControlService.validateFileAccess(file, null, 'read');

    const url = await this.fileOperationsService.generateSignedUrl({
      fileId,
      expirationSeconds: expiry,
    });

    return {
      url,
      expirationSeconds: expiry,
      isPublic: true,
    };
  }
}
