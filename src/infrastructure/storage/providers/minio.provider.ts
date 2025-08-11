import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { IStorageProvider, IStorageFile } from '@core/services/storage.service';
import { File } from '@core/entities/file.entity';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { FILE_REPOSITORY } from '@shared/constants/tokens';
import { BusinessConfigurationService } from '@core/services/business-configuration.service';

@Injectable()
export class MinioStorageProvider implements IStorageProvider {
  private minioClient: Minio.Client;
  private readonly bucketName: string;
  private readonly publicFolder: string;
  private readonly privateFolder: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(FILE_REPOSITORY) private readonly fileRepository: IFileRepository,
    private readonly businessConfigService: BusinessConfigurationService,
  ) {
    const minioConfig = this.configService.get('storage.minio');
    this.bucketName = minioConfig.bucketName;
    this.publicFolder = minioConfig.publicFolder;
    this.privateFolder = minioConfig.privateFolder;

    this.minioClient = new Minio.Client({
      endPoint: minioConfig.endPoint,
      port: minioConfig.port,
      useSSL: minioConfig.useSSL,
      accessKey: minioConfig.accessKey,
      secretKey: minioConfig.secretKey,
      region: minioConfig.region,
    });

    this.initializeBuckets().catch(err => {
      console.error('Error initializing MinIO buckets:', err);
    });
  }

  private async initializeBuckets(): Promise<void> {
    const exists = await this.minioClient.bucketExists(this.bucketName);
    if (!exists) {
      await this.minioClient.makeBucket(
        this.bucketName,
        this.configService.get('storage.minio.region'),
      );

      // Set public policy for public folder
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucketName}/${this.publicFolder}/*`],
          },
        ],
      };
      await this.minioClient.setBucketPolicy(this.bucketName, JSON.stringify(policy));
    }
  }

  async upload(file: IStorageFile, userId?: string): Promise<File> {
    // Validate file type and size
    this.validateFile(file);

    const filename = `${uuidv4()}${path.extname(file.originalname)}`;
    const isPublic = this.isPublicFile(file.mimetype);
    const folder = isPublic ? this.publicFolder : this.privateFolder;
    const filePath = userId ? `${folder}/${userId}/${filename}` : `${folder}/${filename}`;

    await this.minioClient.putObject(this.bucketName, filePath, file.buffer);

    const fileEntity = new File(
      filename,
      file.originalname,
      filePath,
      file.mimetype,
      file.size,
      this.bucketName,
      userId || null,
      isPublic,
    );

    return this.fileRepository.save(fileEntity);
  }

  async getSignedUrl(file: File): Promise<string> {
    const fileConfig = this.businessConfigService.getFileStorageConfig();
    const expiry = fileConfig.urlExpirationHours * 60 * 60; // Convert hours to seconds

    return this.minioClient.presignedGetObject(this.bucketName, file.path, expiry);
  }

  async delete(file: File): Promise<void> {
    await this.minioClient.removeObject(this.bucketName, file.path);
  }

  private isPublicFile(mimeType: string): boolean {
    // Consider images and PDFs as public by default
    return mimeType.startsWith('image/') || mimeType === 'application/pdf';
  }

  private validateFile(file: IStorageFile): void {
    // File size and type validation is now handled by FileUploadLimitGuard
    // and UserStorageConfig before reaching this point

    // Basic validation for empty files
    if (file.size <= 0) {
      throw new Error('File cannot be empty');
    }

    if (!file.originalname || file.originalname.trim() === '') {
      throw new Error('File must have a valid name');
    }

    // Basic file extension validation
    const extension = path.extname(file.originalname).toLowerCase();
    if (!extension) {
      throw new Error('File must have an extension');
    }
  }
}
