import { ConfigService } from '@nestjs/config';
import { ILogger } from '@core/interfaces/logger.interface';
import { IStorageService } from '@core/repositories/storage.service.interface';
import { MinioStorageService } from './minio-storage.service';
import { AwsS3StorageService } from './aws-s3-storage.service';

/**
 * Storage Provider Factory
 *
 * Creates the appropriate storage service implementation based on configuration.
 * Supports dynamic switching between MinIO and AWS S3 providers.
 *
 * Provider selection is controlled by the STORAGE_DRIVER environment variable:
 * - 'minio': Uses MinIO storage service (default for development)
 * - 'aws': Uses AWS S3 storage service (recommended for production)
 */
export class StorageProviderFactory {
  /**
   * Creates a storage service instance based on configuration
   *
   * @param configService - NestJS configuration service
   * @param logger - Logger instance for debugging and monitoring
   * @returns IStorageService implementation (MinIO or AWS S3)
   * @throws Error if unsupported provider is specified
   */
  static create(configService: ConfigService, logger: ILogger): IStorageService {
    const provider = configService.get<string>('storage.provider', 'minio').toLowerCase();

    logger.log({
      message: 'Creating storage service provider',
      provider,
      context: 'StorageProviderFactory',
    });

    switch (provider) {
      case 'aws':
      case 's3':
        logger.log({
          message: 'Initializing AWS S3 storage service',
          context: 'StorageProviderFactory',
        });

        return new AwsS3StorageService(configService, logger);

      case 'minio':
      default:
        logger.log({
          message: 'Initializing MinIO storage service',
          context: 'StorageProviderFactory',
        });

        return new MinioStorageService(configService, logger);
    }
  }

  /**
   * Validates storage provider configuration
   *
   * @param configService - NestJS configuration service
   * @returns Validation result with details
   */
  static validateConfig(configService: ConfigService): {
    isValid: boolean;
    provider: string;
    errors: string[];
    warnings: string[];
  } {
    const provider = configService.get<string>('storage.provider', 'minio').toLowerCase();
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate common configuration
    const defaultBucket = configService.get<string>('storage.defaultBucket');
    if (!defaultBucket) {
      errors.push('storage.defaultBucket is required');
    }

    // Provider-specific validation
    switch (provider) {
      case 'aws':
      case 's3':
        // AWS S3 validation
        const awsRegion = configService.get<string>('storage.aws.region');
        const awsBucket = configService.get<string>('storage.aws.bucketName');
        const awsAccessKey = configService.get<string>('storage.aws.accessKeyId');
        const awsSecretKey = configService.get<string>('storage.aws.secretAccessKey');

        if (!awsRegion) {
          errors.push('storage.aws.region is required for AWS S3');
        }

        if (!awsBucket) {
          errors.push('storage.aws.bucketName is required for AWS S3');
        }

        if (!awsAccessKey || !awsSecretKey) {
          warnings.push('AWS credentials not found, relying on IAM roles or environment');
        }

        break;

      case 'minio':
        // MinIO validation
        const minioEndpoint = configService.get<string>('storage.minio.endpoint');
        const minioAccessKey = configService.get<string>('storage.minio.accessKey');
        const minioSecretKey = configService.get<string>('storage.minio.secretKey');
        const minioBucket = configService.get<string>('storage.minio.bucketName');

        if (!minioEndpoint) {
          errors.push('storage.minio.endpoint is required for MinIO');
        }

        if (!minioAccessKey || !minioSecretKey) {
          errors.push('storage.minio.accessKey and secretKey are required for MinIO');
        }

        if (!minioBucket) {
          errors.push('storage.minio.bucketName is required for MinIO');
        }

        break;

      default:
        errors.push(`Unsupported storage provider: ${provider}. Supported providers: minio, aws`);
    }

    return {
      isValid: errors.length === 0,
      provider,
      errors,
      warnings,
    };
  }

  /**
   * Gets provider-specific health check information
   *
   * @param configService - NestJS configuration service
   * @returns Provider info for health checks
   */
  static getProviderInfo(configService: ConfigService): {
    provider: string;
    endpoint: string;
    bucket: string;
    region?: string;
  } {
    const provider = configService.get<string>('storage.provider', 'minio').toLowerCase();

    switch (provider) {
      case 'aws':
      case 's3':
        return {
          provider: 'aws-s3',
          endpoint: configService.get<string>('storage.aws.endpoint') || 'AWS S3 Standard',
          bucket: configService.get<string>('storage.aws.bucketName', ''),
          region: configService.get<string>('storage.aws.region', 'us-east-1'),
        };

      case 'minio':
      default:
        return {
          provider: 'minio',
          endpoint: configService.get<string>('storage.minio.endpoint', ''),
          bucket: configService.get<string>('storage.minio.bucketName', ''),
          region: configService.get<string>('storage.minio.region', 'us-east-1'),
        };
    }
  }

  /**
   * Lists all supported storage providers
   *
   * @returns Array of supported provider names
   */
  static getSupportedProviders(): string[] {
    return ['minio', 'aws', 's3'];
  }

  /**
   * Gets provider capabilities and features
   *
   * @param provider - Provider name
   * @returns Provider capabilities
   */
  static getProviderCapabilities(provider: string): {
    multipartUpload: boolean;
    presignedUrls: boolean;
    acl: boolean;
    versioning: boolean;
    encryption: boolean;
    crossRegionReplication: boolean;
    lifecycle: boolean;
    maxFileSize: string;
    costModel: string;
  } {
    switch (provider.toLowerCase()) {
      case 'aws':
      case 's3':
        return {
          multipartUpload: true,
          presignedUrls: true,
          acl: true,
          versioning: true,
          encryption: true,
          crossRegionReplication: true,
          lifecycle: true,
          maxFileSize: '5TB',
          costModel: 'Pay-per-use',
        };

      case 'minio':
      default:
        return {
          multipartUpload: true,
          presignedUrls: true,
          acl: true,
          versioning: true,
          encryption: true,
          crossRegionReplication: false,
          lifecycle: true,
          maxFileSize: '5TB',
          costModel: 'Self-hosted',
        };
    }
  }
}
