import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { MultipartUploadService } from '@core/services/multipart-upload.service';
import { InvalidParameterException } from '@core/exceptions/domain-exceptions';

export interface IGeneratePartUrlResponse {
  url: string;
  partNumber: number;
  expirationSeconds: number;
}

export class GeneratePartUrlCommand implements ICommand {
  constructor(
    public readonly fileId: string,
    public readonly partNumber: string,
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
    const { fileId, partNumber, expirationSeconds } = command;

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

    const result = await this.multipartUploadService.generatePartUrl(fileId, partNum, expiry);

    return result;
  }
}
