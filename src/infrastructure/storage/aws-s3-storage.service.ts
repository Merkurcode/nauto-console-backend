import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectAclCommand,
  ListObjectsV2Command,
  CreateBucketCommand,
  HeadBucketCommand,
  CompletedPart,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import {
  IStorageService,
  ICompletedPart,
  IMultipartUploadResult,
  ICompleteUploadResult,
  IPresignedUrlResult,
  IListPartsResult,
  IUploadPart,
} from '@core/repositories/storage.service.interface';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

@Injectable()
export class AwsS3StorageService implements IStorageService {
  private readonly s3Client: S3Client;

  constructor(
    private readonly configService: ConfigService,
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
  ) {
    this.logger.setContext(AwsS3StorageService.name);

    const awsConfig = this.configService.get<any>('storage.aws') ?? {};
    const region = awsConfig.region || 'us-east-1';

    const clientConfig: any = {
      region,
      forcePathStyle: !!awsConfig.forcePathStyle,
    };

    if (awsConfig.endpoint) clientConfig.endpoint = awsConfig.endpoint;

    if (awsConfig.accessKeyId && awsConfig.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: awsConfig.accessKeyId,
        secretAccessKey: awsConfig.secretAccessKey,
      };
    }

    this.s3Client = new S3Client(clientConfig);

    this.logger.log({
      message: 'AWS S3 Storage Service initialized',
      region,
      endpoint: awsConfig.endpoint || 'AWS S3',
      forcePathStyle: !!awsConfig.forcePathStyle,
    });
  }

  // ============================================================================
  // MULTIPART UPLOAD OPERATIONS
  // ============================================================================

  async initiateMultipartUpload(
    bucket: string,
    objectKey: string,
    contentType: string,
  ): Promise<IMultipartUploadResult> {
    try {
      this.logger.debug({ message: 'Initiating multipart upload', bucket, objectKey, contentType });

      this.validateBucketName(bucket);
      this.validateObjectKey(objectKey);
      await this.ensureBucketExists(bucket);

      const command = new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: objectKey,
        ContentType: contentType || 'application/octet-stream',
      });

      const response = await this.s3Client.send(command);
      if (!response.UploadId) throw new Error('No UploadId returned');

      this.logger.debug({
        message: 'Multipart upload initiated successfully',
        bucket,
        objectKey,
        uploadId: response.UploadId,
      });

      return { uploadId: response.UploadId };
    } catch (error: any) {
      this.logger.error({
        message: 'Failed to initiate multipart upload',
        bucket,
        objectKey,
        error: error?.message,
      });
      throw new Error(`Failed to initiate multipart upload: ${error?.message ?? String(error)}`);
    }
  }

  async generatePresignedPartUrl(
    bucket: string,
    objectKey: string,
    uploadId: string,
    partNumber: number,
    expirationSeconds: number,
  ): Promise<IPresignedUrlResult> {
    try {
      this.logger.debug({
        message: 'Generating presigned URL for part upload',
        bucket,
        objectKey,
        uploadId: `${uploadId?.slice(0, 20)}...`,
        partNumber,
        expirationSeconds,
      });

      this.validateBucketName(bucket);
      this.validateObjectKey(objectKey);
      this.validatePartNumber(partNumber);
      this.validateExpirationSeconds(expirationSeconds);

      const command = new UploadPartCommand({
        Bucket: bucket,
        Key: objectKey,
        UploadId: uploadId,
        PartNumber: partNumber,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn: expirationSeconds });

      this.logger.debug({
        message: 'Presigned URL generated successfully',
        bucket,
        objectKey,
        partNumber,
        expirationSeconds,
      });

      return { url };
    } catch (error: any) {
      this.logger.error({
        message: 'Failed to generate presigned URL',
        bucket,
        objectKey,
        partNumber,
        error: error?.message,
      });
      throw new Error(`Failed to generate presigned URL: ${error?.message ?? String(error)}`);
    }
  }

  async completeMultipartUpload(
    bucket: string,
    objectKey: string,
    uploadId: string,
    parts: ICompletedPart[],
  ): Promise<ICompleteUploadResult> {
    try {
      this.logger.debug({
        message: 'Completing multipart upload',
        bucket,
        objectKey,
        uploadId: `${uploadId?.slice(0, 20)}...`,
        partsCount: parts.length,
      });

      this.validateBucketName(bucket);
      this.validateObjectKey(objectKey);
      this.validateCompletedParts(parts);

      const completedParts: CompletedPart[] = parts.map(p => ({
        ETag: p.ETag, // debe coincidir exactamente con el devuelto por UploadPart
        PartNumber: p.PartNumber,
      }));

      const command = new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: objectKey,
        UploadId: uploadId,
        MultipartUpload: { Parts: completedParts },
      });

      const response = await this.s3Client.send(command);

      this.logger.debug({
        message: 'Multipart upload completed successfully',
        bucket,
        objectKey,
        etag: response.ETag,
      });

      // Normaliza el etag quitando comillas para mantener consistencia con getObjectMetadata
      return { etag: (response.ETag ?? '').replace(/"/g, '') };
    } catch (error: any) {
      this.logger.error({
        message: 'Failed to complete multipart upload',
        bucket,
        objectKey,
        uploadId: `${uploadId?.slice(0, 20)}...`,
        error: error?.message,
      });
      throw new Error(`Failed to complete multipart upload: ${error?.message ?? String(error)}`);
    }
  }

  async abortMultipartUpload(bucket: string, objectKey: string, uploadId: string): Promise<void> {
    try {
      this.logger.debug({
        message: 'Aborting multipart upload',
        bucket,
        objectKey,
        uploadId: `${uploadId?.slice(0, 20)}...`,
      });

      this.validateBucketName(bucket);
      this.validateObjectKey(objectKey);

      const command = new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: objectKey,
        UploadId: uploadId,
      });
      await this.s3Client.send(command);

      this.logger.debug({ message: 'Multipart upload aborted successfully', bucket, objectKey });
    } catch (error: any) {
      this.logger.error({
        message: 'Failed to abort multipart upload',
        bucket,
        objectKey,
        uploadId: `${uploadId?.slice(0, 20)}...`,
        error: error?.message,
      });
      throw new Error(`Failed to abort multipart upload: ${error?.message ?? String(error)}`);
    }
  }

  async listUploadParts(
    bucket: string,
    objectKey: string,
    uploadId: string,
  ): Promise<IListPartsResult> {
    try {
      this.logger.debug({
        message: 'Listing upload parts',
        bucket,
        objectKey,
        uploadId: `${uploadId?.slice(0, 20)}...`,
      });

      this.validateBucketName(bucket);
      this.validateObjectKey(objectKey);

      const parts: IUploadPart[] = [];
      let partNumberMarker: string | undefined;

      do {
        const command = new ListPartsCommand({
          Bucket: bucket,
          Key: objectKey,
          UploadId: uploadId,
          PartNumberMarker: partNumberMarker,
          MaxParts: 1000,
        });

        const res = await this.s3Client.send(command);
        (res.Parts ?? []).forEach(p =>
          parts.push({
            PartNumber: p.PartNumber!,
            LastModified: p.LastModified,
            ETag: (p.ETag || '').replace(/^"+|"+$/g, ''), // quitar comillas,
            Size: p.Size,
          }),
        );

        if (res.IsTruncated) {
          partNumberMarker = res.NextPartNumberMarker;
        } else {
          partNumberMarker = undefined;
        }
      } while (partNumberMarker !== undefined);

      const result: IListPartsResult = {
        uploadId,
        parts,
        totalPartsCount: parts.length,
        completedPartsCount: parts.filter(p => !!p.ETag).length,
      };

      this.logger.debug({
        message: 'Upload parts listed successfully',
        bucket,
        objectKey,
        totalParts: result.totalPartsCount,
        completedParts: result.completedPartsCount,
      });

      return result;
    } catch (error: any) {
      this.logger.error({
        message: 'Failed to list upload parts',
        bucket,
        objectKey,
        uploadId: `${uploadId?.slice(0, 20)}...`,
        error: error?.message,
      });
      throw new Error(`Failed to list upload parts: ${error?.message ?? String(error)}`);
    }
  }

  // ============================================================================
  // OBJECT OPERATIONS
  // ============================================================================

  async copyObject(
    sourceBucket: string,
    sourceKey: string,
    destinationBucket: string,
    destinationKey: string,
  ): Promise<void> {
    try {
      this.logger.debug({
        message: 'Copying object',
        sourceBucket,
        sourceKey,
        destinationBucket,
        destinationKey,
      });

      this.validateBucketName(sourceBucket);
      this.validateBucketName(destinationBucket);
      this.validateObjectKey(sourceKey);
      this.validateObjectKey(destinationKey);

      // CopySource debe ir URL-encoded
      const copySource = `/${sourceBucket}/${encodeURIComponent(sourceKey).replace(/%2F/g, '/')}`;

      const command = new CopyObjectCommand({
        Bucket: destinationBucket,
        Key: destinationKey,
        CopySource: copySource,
      });

      await this.s3Client.send(command);

      this.logger.debug({
        message: 'Object copied successfully',
        sourceBucket,
        sourceKey,
        destinationBucket,
        destinationKey,
      });
    } catch (error: any) {
      this.logger.error({
        message: 'Failed to copy object',
        sourceBucket,
        sourceKey,
        destinationBucket,
        destinationKey,
        error: error?.message,
      });
      throw new Error(`Failed to copy object: ${error?.message ?? String(error)}`);
    }
  }

  async deleteObject(bucket: string, objectKey: string): Promise<void> {
    try {
      this.logger.debug({ message: 'Deleting object', bucket, objectKey });

      this.validateBucketName(bucket);
      this.validateObjectKey(objectKey);

      const command = new DeleteObjectCommand({ Bucket: bucket, Key: objectKey });
      await this.s3Client.send(command);

      this.logger.debug({ message: 'Object deleted successfully', bucket, objectKey });
    } catch (error: any) {
      this.logger.error({
        message: 'Failed to delete object',
        bucket,
        objectKey,
        error: error?.message,
      });
      throw new Error(`Failed to delete object: ${error?.message ?? String(error)}`);
    }
  }

  async deleteObjects(bucket: string, objectKeys: string[]): Promise<void> {
    try {
      this.logger.debug({
        message: 'Deleting multiple objects',
        bucket,
        objectCount: objectKeys.length,
      });

      this.validateBucketName(bucket);
      objectKeys.forEach(k => this.validateObjectKey(k));

      if (!objectKeys.length) return;

      const batchSize = 1000;
      for (let i = 0; i < objectKeys.length; i += batchSize) {
        const batch = objectKeys.slice(i, i + batchSize);
        const out = await this.s3Client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: batch.map(Key => ({ Key })) },
          }),
        );

        if (out.Errors && out.Errors.length) {
          // Log y lanzar error con detalle de las claves que fallaron
          const details = out.Errors.map(e => ({
            key: e.Key,
            code: e.Code,
            message: e.Message,
          }));
          this.logger.error({
            message: 'Partial delete failure',
            bucket,
            failedCount: details.length,
            details,
          });
          throw new Error(
            `DeleteObjects partial failure: ${details
              .map(d => `${d.key} (${d.code}: ${d.message})`)
              .join(', ')}`,
          );
        }
      }

      this.logger.debug({
        message: 'Objects deleted successfully',
        bucket,
        objectCount: objectKeys.length,
      });
    } catch (error: any) {
      this.logger.error({
        message: 'Failed to delete objects',
        bucket,
        objectCount: objectKeys.length,
        error: error?.message,
      });
      throw new Error(`Failed to delete objects: ${error?.message ?? String(error)}`);
    }
  }

  async objectExists(bucket: string, objectKey: string): Promise<boolean> {
    try {
      this.validateBucketName(bucket);
      this.validateObjectKey(objectKey);

      const command = new HeadObjectCommand({ Bucket: bucket, Key: objectKey });
      await this.s3Client.send(command);

      return true;
    } catch (error: any) {
      const code = error?.name || error?.Code;
      const status = error?.$metadata?.httpStatusCode;
      if (code === 'NotFound' || code === 'NoSuchKey' || status === 404) return false;

      this.logger.error({
        message: 'Failed to check object existence',
        bucket,
        objectKey,
        error: error?.message,
      });
      throw new Error(`Failed to check object existence: ${error?.message ?? String(error)}`);
    }
  }

  async getObjectMetadata(
    bucket: string,
    objectKey: string,
  ): Promise<{ size: number; lastModified: Date; etag: string; contentType: string }> {
    try {
      this.logger.debug({ message: 'Getting object metadata', bucket, objectKey });

      this.validateBucketName(bucket);
      this.validateObjectKey(objectKey);

      const command = new HeadObjectCommand({ Bucket: bucket, Key: objectKey });
      const res = await this.s3Client.send(command);

      return {
        size: res.ContentLength || 0,
        lastModified: res.LastModified || new Date(),
        etag: (res.ETag ?? '').replace(/"/g, ''),
        contentType: res.ContentType || 'application/octet-stream',
      };
    } catch (error: any) {
      this.logger.error({
        message: 'Failed to get object metadata',
        bucket,
        objectKey,
        error: error?.message,
      });
      throw new Error(`Failed to get object metadata: ${error?.message ?? String(error)}`);
    }
  }

  // ============================================================================
  // ACCESS CONTROL OPERATIONS
  // ============================================================================

  async setObjectPublic(bucket: string, objectKey: string): Promise<void> {
    try {
      this.logger.debug({ message: 'Setting object to public', bucket, objectKey });

      this.validateBucketName(bucket);
      this.validateObjectKey(objectKey);

      const command = new PutObjectAclCommand({
        Bucket: bucket,
        Key: objectKey,
        ACL: 'public-read',
      });
      await this.s3Client.send(command);
    } catch (error: any) {
      // Si el bucket usa ObjectOwnership=BucketOwnerEnforced, S3 rechaza cualquier ACL
      const code = error?.name || error?.Code;
      if (code === 'AccessControlListNotSupported' || code === 'InvalidRequest') {
        throw new Error(
          'ACLs are disabled for this bucket (BucketOwnerEnforced). ' +
            'Switch visibility via bucket policy/CloudFront or use presigned URLs only.',
        );
      }
      this.logger.error({
        message: 'Failed to set object public',
        bucket,
        objectKey,
        error: error?.message,
      });
      throw new Error(`Failed to set object public: ${error?.message ?? String(error)}`);
    }
  }

  async setObjectPrivate(bucket: string, objectKey: string): Promise<void> {
    try {
      this.logger.debug({ message: 'Setting object to private', bucket, objectKey });

      this.validateBucketName(bucket);
      this.validateObjectKey(objectKey);

      const command = new PutObjectAclCommand({ Bucket: bucket, Key: objectKey, ACL: 'private' });
      await this.s3Client.send(command);
    } catch (error: any) {
      const code = error?.name || error?.Code;
      if (code === 'AccessControlListNotSupported' || code === 'InvalidRequest') {
        throw new Error(
          'ACLs are disabled for this bucket (BucketOwnerEnforced). ' +
            'Object privacy must be enforced via bucket policy/IAM, or use presigned URLs.',
        );
      }
      this.logger.error({
        message: 'Failed to set object private',
        bucket,
        objectKey,
        error: error?.message,
      });
      throw new Error(`Failed to set object private: ${error?.message ?? String(error)}`);
    }
  }

  async generatePresignedGetUrl(
    bucket: string,
    objectKey: string,
    expirationSeconds: number,
  ): Promise<IPresignedUrlResult> {
    try {
      this.logger.debug({
        message: 'Generating presigned GET URL',
        bucket,
        objectKey,
        expirationSeconds,
      });

      this.validateBucketName(bucket);
      this.validateObjectKey(objectKey);
      this.validateExpirationSeconds(expirationSeconds);

      const command = new GetObjectCommand({ Bucket: bucket, Key: objectKey });
      const url = await getSignedUrl(this.s3Client, command, { expiresIn: expirationSeconds });

      return { url };
    } catch (error: any) {
      this.logger.error({
        message: 'Failed to generate presigned GET URL',
        bucket,
        objectKey,
        expirationSeconds,
        error: error?.message,
      });
      throw new Error(`Failed to generate presigned GET URL: ${error?.message ?? String(error)}`);
    }
  }

  // ============================================================================
  // FOLDER/PREFIX OPERATIONS
  // ============================================================================

  async listObjectsByPrefix(bucket: string, prefix: string): Promise<string[]> {
    try {
      this.logger.debug({ message: 'Listing objects by prefix', bucket, prefix });

      this.validateBucketName(bucket);

      const keys: string[] = [];
      let continuationToken: string | undefined;

      do {
        const res = await this.s3Client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
            MaxKeys: 1000,
          }),
        );

        (res.Contents ?? []).forEach(o => {
          if (o.Key) keys.push(o.Key);
        });

        continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
      } while (continuationToken);

      this.logger.debug({
        message: 'Objects listed by prefix successfully',
        bucket,
        prefix,
        objectCount: keys.length,
      });

      return keys;
    } catch (error: any) {
      this.logger.error({
        message: 'Failed to list objects by prefix',
        bucket,
        prefix,
        error: error?.message,
      });
      throw new Error(`Failed to list objects by prefix: ${error?.message ?? String(error)}`);
    }
  }

  async deleteObjectsByPrefix(bucket: string, prefix: string): Promise<number> {
    try {
      this.logger.debug({ message: 'Deleting objects by prefix', bucket, prefix });

      this.validateBucketName(bucket);

      const keys = await this.listObjectsByPrefix(bucket, prefix);
      if (!keys.length) return 0;

      await this.deleteObjects(bucket, keys);

      this.logger.debug({
        message: 'Objects deleted by prefix successfully',
        bucket,
        prefix,
        deletedCount: keys.length,
      });

      return keys.length;
    } catch (error: any) {
      this.logger.error({
        message: 'Failed to delete objects by prefix',
        bucket,
        prefix,
        error: error?.message,
      });
      throw new Error(`Failed to delete objects by prefix: ${error?.message ?? String(error)}`);
    }
  }

  // ============================================================================
  // BUCKET OPERATIONS
  // ============================================================================

  async bucketExists(bucket: string): Promise<boolean> {
    try {
      this.validateBucketName(bucket);
      await this.s3Client.send(new HeadBucketCommand({ Bucket: bucket }));

      return true;
    } catch (error: any) {
      const status = error?.$metadata?.httpStatusCode;
      const code = error?.name || error?.Code;
      if (status === 404 || code === 'NotFound' || code === 'NoSuchBucket') return false;
      // 403 puede significar que existe pero no tienes permisos: re-lanzamos para visibilizarlo
      throw new Error(`Failed to check bucket existence: ${error?.message ?? String(error)}`);
    }
  }

  async createBucket(bucket: string): Promise<void> {
    try {
      this.logger.debug({ message: 'Creating bucket', bucket });

      this.validateBucketName(bucket);

      const region = this.configService.get<string>('storage.aws.region') || 'us-east-1';
      const params: any =
        region === 'us-east-1'
          ? { Bucket: bucket }
          : { Bucket: bucket, CreateBucketConfiguration: { LocationConstraint: region } };

      await this.s3Client.send(new CreateBucketCommand(params));

      this.logger.debug({ message: 'Bucket created successfully', bucket, region });
    } catch (error: any) {
      // Idempotencia frente a carreras
      const code = error?.name || error?.Code;
      if (code === 'BucketAlreadyOwnedByYou' || code === 'BucketAlreadyExists') {
        this.logger.warn(`Bucket ${bucket} already exists/owned; continuing.`);

        return;
      }
      this.logger.error({ message: 'Failed to create bucket', bucket, error: error?.message });
      throw new Error(`Failed to create bucket: ${error?.message ?? String(error)}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const bucket =
        this.configService.get<string>('storage.aws.healthCheckBucket') ||
        this.configService.get<string>('storage.aws.bucketName');

      if (bucket) {
        await this.s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
      } else {
        // Si no hay bucket configurado, hacemos una operación “barata” presignando algo corto
        await getSignedUrl(this.s3Client, new GetObjectCommand({ Bucket: 'dummy', Key: 'dummy' }), {
          expiresIn: 1,
        }).catch(() => {});
      }

      return true;
    } catch (error: any) {
      this.logger.error({ message: 'AWS S3 health check failed', error: error?.message });

      return false;
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async ensureBucketExists(bucket: string): Promise<void> {
    const exists = await this.bucketExists(bucket).catch(() => false);
    if (!exists) await this.createBucket(bucket);
  }

  private validateBucketName(bucket: string): void {
    if (!bucket || typeof bucket !== 'string') throw new Error('Bucket name is required');
    if (bucket.length < 3 || bucket.length > 63) throw new Error('Bucket name must be 3–63 chars');
    if (!/^[a-z0-9.-]+$/.test(bucket)) throw new Error('Bucket name contains invalid characters');
    if (bucket.includes('..')) throw new Error('Bucket name cannot contain consecutive periods');
  }

  private validateObjectKey(objectKey: string): void {
    if (!objectKey || typeof objectKey !== 'string') throw new Error('Object key is required');
    if (objectKey.includes('..')) throw new Error('Object key cannot contain path traversal');
    if (objectKey.includes('\x00')) throw new Error('Object key contains null bytes');
    if (objectKey.length > 1024) throw new Error('Object key cannot exceed 1024 characters');
  }

  private validatePartNumber(partNumber: number): void {
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000) {
      throw new Error('Part number must be an integer between 1 and 10000');
    }
  }

  private validateExpirationSeconds(expirationSeconds: number): void {
    if (
      !Number.isInteger(expirationSeconds) ||
      expirationSeconds < 1 ||
      expirationSeconds > 604800
    ) {
      throw new Error('Expiration seconds must be between 1 and 604800 (7 days)');
    }
  }

  private validateCompletedParts(parts: ICompletedPart[]): void {
    if (!Array.isArray(parts) || parts.length === 0) {
      throw new Error('Parts array is required and cannot be empty');
    }
    const seen = new Set<number>();
    for (const p of parts) {
      if (!p?.ETag || typeof p.ETag !== 'string')
        throw new Error('Each part must have a valid ETag');
      this.validatePartNumber(p.PartNumber);
      if (seen.has(p.PartNumber)) throw new Error(`Duplicate part number ${p.PartNumber}`);
      seen.add(p.PartNumber);
    }
  }
}
