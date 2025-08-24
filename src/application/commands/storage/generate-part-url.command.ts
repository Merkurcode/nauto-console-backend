import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { MultipartUploadService } from '@core/services/multipart-upload.service';
import { InvalidParameterException } from '@core/exceptions/domain-exceptions';
import { IGeneratePartUrlResponse } from '@application/dtos/_responses/storage/storage.response.interface';

export class GeneratePartUrlCommand implements ICommand {
  constructor(
    public readonly fileId: string,
    public readonly partNumber: string,
    public readonly partSizeBytes: number,
    public readonly expirationSeconds?: string,
  ) {}
}

@Injectable()
@CommandHandler(GeneratePartUrlCommand)
export class GeneratePartUrlHandler
  implements ICommandHandler<GeneratePartUrlCommand, IGeneratePartUrlResponse>
{
  constructor(private readonly multipartUploadService: MultipartUploadService) {}

  async execute(command: GeneratePartUrlCommand): Promise<IGeneratePartUrlResponse> {
    const { fileId, partNumber, partSizeBytes, expirationSeconds } = command;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(fileId)) {
      throw new InvalidParameterException('fileId', fileId, 'Must be a valid UUID');
    }

    // Validate part number
    const partNum = parseInt(partNumber, 10);
    if (isNaN(partNum)) {
      throw new InvalidParameterException('partNumber', partNumber, 'Must be a valid number');
    }

    // Validate part size
    if (!Number.isInteger(partSizeBytes) || partSizeBytes <= 0) {
      throw new InvalidParameterException(
        'partSizeBytes',
        partSizeBytes.toString(),
        'Must be a positive integer',
      );
    }

    // Validate expiration seconds if provided
    let expiry: number | undefined;
    if (expirationSeconds) {
      expiry = parseInt(expirationSeconds, 10);
      if (isNaN(expiry)) {
        throw new InvalidParameterException(
          'expirationSeconds',
          expirationSeconds,
          'Must be a valid number',
        );
      }
    }

    const result = await this.multipartUploadService.generatePartUrl(
      partSizeBytes,
      fileId,
      partNum,
      expiry,
    );

    return result;
  }
}
