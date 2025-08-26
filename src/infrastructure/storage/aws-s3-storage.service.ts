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
  PutObjectCommand,
  //PutObjectAclCommand,
  ListObjectsV2Command,
  CreateBucketCommand,
  HeadBucketCommand,
  CompletedPart,
  PutObjectCommandInput,
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
  IUploadStatusResult,
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
    maxBytes: number,
    isPublic: boolean,
  ): Promise<IMultipartUploadResult> {
    try {
      const effectiveMax = Math.floor(maxBytes!);

      this.logger.debug({
        message: 'Initiating multipart upload',
        bucket,
        objectKey,
        contentType,
        maxBytes,
        effectiveMax,
        isPublic,
      });

      this.validateBucketName(bucket);
      this.validateObjectKey(objectKey);
      await this.ensureBucketExists(bucket);

      const command = new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: objectKey,
        ContentType: contentType || 'application/octet-stream',
        // Guarda el límite como metadata informativa (no lo hace cumplir S3, pero ayuda a trazabilidad)
        Metadata: { 'app-max-bytes': String(effectiveMax) },
        ACL: isPublic ? 'public-read' : 'private',
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

  async getUploadStatus(
    bucket: string,
    objectKey: string,
    uploadId: string,
    maxBytes: number,
  ): Promise<IUploadStatusResult> {
    const { parts } = await this.listUploadParts(bucket, objectKey, uploadId);

    const uploadedBytes = parts.reduce((a, p) => a + (p.Size ?? 0), 0);

    // Construye un set de partes presentes
    const present = new Set<number>();
    const normalized = parts
      .filter(p => typeof p.PartNumber === 'number')
      .map(p => {
        present.add(p.PartNumber!);

        return {
          partNumber: p.PartNumber!,
          size: p.Size ?? 0,
          etag: (p.ETag ?? '').replace(/"/g, ''),
        };
      })
      .sort((a, b) => a.partNumber - b.partNumber);

    // Sugerir el siguiente PartNumber:
    // - Busca el primer hueco [1..max]
    // - Si no hay huecos, sugiere (max+1)
    let nextPartNumber = 1;
    for (let i = 1; i <= normalized.length + 1; i++) {
      if (!present.has(i)) {
        nextPartNumber = i;
        break;
      }
    }

    const totalPartsCount = parts.length;
    const completedPartsCount = normalized.length;

    const vmaxBytes = Math.floor(maxBytes!);

    const remainingBytes =
      typeof vmaxBytes === 'number' ? Math.max(0, vmaxBytes - uploadedBytes) : undefined;

    const canComplete = typeof vmaxBytes === 'number' ? uploadedBytes <= vmaxBytes : true; // si no hay tope, se puede completar (desde el punto de vista de tamaño)

    return {
      uploadId,
      uploadedBytes,
      parts: normalized,
      totalPartsCount,
      completedPartsCount,
      nextPartNumber,
      maxBytes: maxBytes,
      remainingBytes,
      canComplete,
    };
  }

  async generatePresignedPartUrl(
    bucket: string,
    objectKey: string,
    uploadId: string,
    partNumber: number,
    expirationSeconds: number,
    declaredPartSizeBytes: number,
    maxBytes: number,
  ): Promise<IPresignedUrlResult> {
    try {
      const effectiveMax = Math.floor(maxBytes!);

      this.logger.debug({
        message: 'Generating presigned URL for part upload',
        bucket,
        objectKey,
        uploadId: `${uploadId?.slice(0, 20)}...`,
        partNumber,
        expirationSeconds,
        declaredPartSizeBytes,
        maxBytes,
        effectiveMax,
      });

      this.validateBucketName(bucket);
      this.validateObjectKey(objectKey);
      this.validatePartNumber(partNumber);
      this.validateExpirationSeconds(expirationSeconds);

      // Reglas S3: 5 MiB mínimo por parte salvo la última
      if (declaredPartSizeBytes <= 0) throw new Error('declaredPartSizeBytes must be > 0');
      const MIN_PART = 5 * 1024 * 1024;
      if (declaredPartSizeBytes < MIN_PART) {
        // Permitimos tamaños < 5 MiB solo si ya no queda más por subir, pero eso no lo sabemos aquí;
        // así que obligamos al cliente a usar >= 5 MiB y dejar la última más pequeña.
        this.logger.warn(
          `Part ${partNumber} declared with ${declaredPartSizeBytes}B (<5MiB). Ensure it is the last part.`,
        );
      }

      // Valida capacidad restante ANTES de firmar
      await this.ensureRemainingCapacity(
        bucket,
        objectKey,
        uploadId,
        declaredPartSizeBytes,
        effectiveMax,
      );

      // Si quisieras bloquear >10k partes ANTES de que S3 lo rechace:
      const current = await this.listUploadParts(bucket, objectKey, uploadId);
      if (current.totalPartsCount >= 10_000) {
        throw new Error('Maximum number of parts (10,000) reached');
      }

      // Firma con ContentLength "fijo" para que el cliente tenga que enviar ese header exacto
      const command = new UploadPartCommand({
        Bucket: bucket,
        Key: objectKey,
        UploadId: uploadId,
        PartNumber: partNumber,
        ContentLength: declaredPartSizeBytes, // <- esto obliga a que el PUT de la parte tenga ese Content-Length
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
    maxBytes: number,
  ): Promise<ICompleteUploadResult> {
    try {
      const effectiveMax = Math.floor(maxBytes!);

      this.logger.debug({
        message: 'Completing multipart upload',
        bucket,
        objectKey,
        uploadId: `${uploadId?.slice(0, 20)}...`,
        partsCount: parts.length,
        maxBytes,
        effectiveMax,
      });

      this.validateBucketName(bucket);
      this.validateObjectKey(objectKey);
      this.validateCompletedParts(parts);

      // TOPE DURO: lee el tamaño real de TODAS las partes subidas
      const uploadedTotal = await this.getTotalUploadedBytes(bucket, objectKey, uploadId);
      if (uploadedTotal > effectiveMax) {
        this.logger.error({
          message: `Upload exceeds max allowed size (${uploadedTotal} > ${effectiveMax} bytes)`,
          bucket,
          objectKey,
        });
        await this.abortMultipartUpload(bucket, objectKey, uploadId).catch(() => {});
        throw new Error(
          `Upload exceeds max allowed size (${uploadedTotal} > ${effectiveMax} bytes)`,
        );
      }

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

  async moveObject(
    sourceBucket: string,
    sourceKey: string,
    destinationBucket: string,
    destinationKey: string,
  ): Promise<void> {
    try {
      this.logger.debug({
        message: 'Moving object',
        sourceBucket,
        sourceKey,
        destinationBucket,
        destinationKey,
      });

      this.validateBucketName(sourceBucket);
      this.validateBucketName(destinationBucket);
      this.validateObjectKey(sourceKey);
      this.validateObjectKey(destinationKey);

      // AWS S3 doesn't have native move, so implement as copy + delete
      const copySource = `/${sourceBucket}/${sourceKey}`;

      // Step 1: Copy to destination
      const copyCommand = new CopyObjectCommand({
        Bucket: destinationBucket,
        Key: destinationKey,
        CopySource: copySource,
      });
      await this.s3Client.send(copyCommand);

      // Step 2: Delete source
      const deleteCommand = new DeleteObjectCommand({
        Bucket: sourceBucket,
        Key: sourceKey,
      });
      await this.s3Client.send(deleteCommand);

      this.logger.debug({
        message: 'Object moved successfully',
        sourceBucket,
        sourceKey,
        destinationBucket,
        destinationKey,
      });
    } catch (error: any) {
      this.logger.error({
        message: 'Failed to move object',
        sourceBucket,
        sourceKey,
        destinationBucket,
        destinationKey,
        error: error?.message,
      });
      throw new Error(`Failed to move object: ${error?.message ?? String(error)}`);
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
    this.logger.log({
      message: 'Object visibility is managed at application level (no storage changes)',
      bucket,
      objectKey,
    });
    //try {
    //  this.logger.debug({ message: 'Setting object to public', bucket, objectKey });
    //
    //  this.validateBucketName(bucket);
    //  this.validateObjectKey(objectKey);
    //
    //  const command = new PutObjectAclCommand({
    //    Bucket: bucket,
    //    Key: objectKey,
    //    ACL: 'public-read',
    //  });
    //  await this.s3Client.send(command);
    //} catch (error: any) {
    //  // Si el bucket usa ObjectOwnership=BucketOwnerEnforced, S3 rechaza cualquier ACL
    //  const code = error?.name || error?.Code;
    //  if (code === 'AccessControlListNotSupported' || code === 'InvalidRequest') {
    //    throw new Error(
    //      'ACLs are disabled for this bucket (BucketOwnerEnforced). ' +
    //        'Switch visibility via bucket policy/CloudFront or use presigned URLs only.',
    //    );
    //  }
    //  this.logger.error({
    //    message: 'Failed to set object public',
    //    bucket,
    //    objectKey,
    //    error: error?.message,
    //  });
    //  throw new Error(`Failed to set object public: ${error?.message ?? String(error)}`);
    //}
  }

  async setObjectPrivate(bucket: string, objectKey: string): Promise<void> {
    this.logger.log({
      message: 'Object visibility is managed at application level (no storage changes)',
      bucket,
      objectKey,
    });
    //try {
    //  this.logger.debug({ message: 'Setting object to private', bucket, objectKey });
    //
    //  this.validateBucketName(bucket);
    //  this.validateObjectKey(objectKey);
    //
    //  const command = new PutObjectAclCommand({ Bucket: bucket, Key: objectKey, ACL: 'private' });
    //  await this.s3Client.send(command);
    //} catch (error: any) {
    //  const code = error?.name || error?.Code;
    //  if (code === 'AccessControlListNotSupported' || code === 'InvalidRequest') {
    //    throw new Error(
    //      'ACLs are disabled for this bucket (BucketOwnerEnforced). ' +
    //        'Object privacy must be enforced via bucket policy/IAM, or use presigned URLs.',
    //    );
    //  }
    //  this.logger.error({
    //    message: 'Failed to set object private',
    //    bucket,
    //    objectKey,
    //    error: error?.message,
    //  });
    //  throw new Error(`Failed to set object private: ${error?.message ?? String(error)}`);
    //}
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

  async createFolder(
    bucket: string,
    folderPath: string,
    opts?: {
      sse?: 'AES256' | 'aws:kms';
      kmsKeyId?: string; // requerido si sse='aws:kms'
      allowedPrefixRegex?: RegExp;
      idempotent?: boolean; // true => no sobrescribe si ya existe
    },
  ): Promise<void> {
    this.validateBucketName(bucket);
    await this.ensureBucketExists(bucket);

    // Normalize folder path - ensure it ends with /
    const key = this.normalizeS3FolderKey(folderPath, {
      allowedPrefixRegex: opts?.allowedPrefixRegex,
    });

    try {
      // Idempotencia: si ya existe el marker, sal sin crear nueva versión
      if (opts?.idempotent) {
        try {
          await this.s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
          this.logger.log({
            message: 'Folder already exists (idempotent)',
            bucket,
            folderPath: key,
          });

          return;
        } catch (e: any) {
          // Continúa sólo si es 404/NoSuchKey
          const msg = (e?.Code || e?.name || e?.message || '').toString();
          if (!/NotFound|NoSuchKey/i.test(msg) && e?.$metadata?.httpStatusCode !== 404) throw e;
        }
      }

      const input: PutObjectCommandInput = {
        Bucket: bucket,
        Key: key,
        Body: new Uint8Array(0), // 0 bytes
        ContentType: 'application/x-directory',
        ContentLength: 0,
      };

      // Cifrado del lado servidor (ajusta a tu política)
      if (opts?.sse === 'AES256') {
        input.ServerSideEncryption = 'AES256';
      } else if (opts?.sse === 'aws:kms') {
        if (!opts.kmsKeyId) throw new Error("kmsKeyId is required when sse='aws:kms'");
        input.ServerSideEncryption = 'aws:kms';
        input.SSEKMSKeyId = opts.kmsKeyId;
        // Opcional: S3 Bucket Key para KMS (menos costos)
        input.BucketKeyEnabled = true;
      }

      await this.s3Client.send(new PutObjectCommand(input));

      this.logger.log({ message: 'Folder created successfully', bucket, folderPath: key });
    } catch (error: any) {
      // Preserva metadatos útiles de AWS (status, requestId)
      this.logger.error({
        message: 'Failed to create folder',
        bucket,
        folderPath,
        code: error?.Code || error?.name,
        status: error?.$metadata?.httpStatusCode,
        requestId: error?.$metadata?.requestId,
        error: error?.message ?? String(error),
      });
      throw new Error(`Failed to create folder: ${error?.message ?? String(error)}`);
    }
  }

  async deleteFolder(bucket: string, folderPath: string): Promise<void> {
    try {
      this.validateBucketName(bucket);

      // Normalize folder path - ensure it ends with /
      const normalizedPath = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;

      // Delete all objects with this prefix (including the folder marker)
      const deletedCount = await this.deleteObjectsByPrefix(bucket, normalizedPath);

      this.logger.log({
        message: 'Folder deleted successfully',
        bucket,
        folderPath: normalizedPath,
        deletedObjectsCount: deletedCount,
      });
    } catch (error: any) {
      this.logger.error({
        message: 'Failed to delete folder',
        bucket,
        folderPath,
        error: error?.message,
      });
      throw new Error(`Failed to delete folder: ${error?.message ?? String(error)}`);
    }
  }

  async folderExists(bucket: string, folderPath: string): Promise<boolean> {
    try {
      this.validateBucketName(bucket);

      // Normalize folder path - ensure it ends with /
      const normalizedPath = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;

      // Check if the folder marker exists
      try {
        await this.s3Client.send(
          new HeadObjectCommand({
            Bucket: bucket,
            Key: normalizedPath,
          }),
        );

        return true;
      } catch (headError: any) {
        // If folder marker doesn't exist, check if there are any objects with this prefix
        if (headError.name === 'NotFound' || headError.$metadata?.httpStatusCode === 404) {
          const objects = await this.listObjectsByPrefix(bucket, normalizedPath);

          return objects.length > 0;
        }
        throw headError;
      }
    } catch (error: any) {
      this.logger.error({
        message: 'Failed to check folder existence',
        bucket,
        folderPath,
        error: error.message,
      });

      return false;
    }
  }

  /** Suma tamaños de partes subidas hasta ahora */
  private async getTotalUploadedBytes(
    bucket: string,
    objectKey: string,
    uploadId: string,
  ): Promise<number> {
    let total = 0;
    let partNumberMarker: string | undefined;
    do {
      const res = await this.s3Client.send(
        new ListPartsCommand({
          Bucket: bucket,
          Key: objectKey,
          UploadId: uploadId,
          PartNumberMarker: partNumberMarker,
          MaxParts: 1000,
        }),
      );
      for (const p of res.Parts ?? []) total += p.Size ?? 0;
      partNumberMarker = res.IsTruncated ? res.NextPartNumberMarker : undefined;
    } while (partNumberMarker !== undefined);

    return total;
  }

  /** Valida que (cargado + porSubir) no exceda maxBytes */
  private async ensureRemainingCapacity(
    bucket: string,
    objectKey: string,
    uploadId: string,
    aboutToUploadBytes: number,
    maxBytes: number,
  ): Promise<void> {
    if (!Number.isFinite(aboutToUploadBytes) || aboutToUploadBytes < 0) {
      throw new Error('Declared part size must be a non-negative finite number');
    }
    const uploaded = await this.getTotalUploadedBytes(bucket, objectKey, uploadId);
    if (uploaded + aboutToUploadBytes > maxBytes) {
      this.logger.error({
        message: `Upload exceeded max allowed size (${uploaded + aboutToUploadBytes} > ${maxBytes} bytes)`,
        bucket,
        objectKey,
      });
      // Corta de raíz: aborta la subida
      await this.abortMultipartUpload(bucket, objectKey, uploadId).catch(() => {});
      throw new Error(
        `Upload exceeded max allowed size (${uploaded + aboutToUploadBytes} > ${maxBytes} bytes)`,
      );
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

  /** Normaliza/valida un key de “carpeta” para S3 (debe terminar en "/") */
  private normalizeS3FolderKey(
    input: string,
    opts?: {
      maxLen?: number;
      allowedPrefixRegex?: RegExp; // p.ej. /^tenants\/[a-z0-9-]+\/users\/[a-z0-9-]+\/?/i
    },
  ): string {
    if (!input || typeof input !== 'string') throw new Error('folderPath required');

    let k = input;
    try {
      k = decodeURIComponent(k);
    } catch {}
    k = k.replace(/\\/g, '/'); // backslashes -> slash
    k = k.replace(/\/+/g, '/'); // colapsa //
    k = k.replace(/^\/+|\/+$/g, ''); // quita / inicial/final

    // rechaza absolutos/UNC/drive (por si llegan desde UI)
    if (k.startsWith('/') || k.startsWith('//') || /^[a-zA-Z]:/.test(k)) {
      throw new Error('folderPath must be relative');
    }
    // niega "." y ".."
    const parts = k.split('/').filter(Boolean);
    for (const p of parts) if (p === '.' || p === '..') throw new Error('path traversal detected');

    // aplica prefijo permitido (multi-tenant)
    if (opts?.allowedPrefixRegex && !opts.allowedPrefixRegex.test(k + '/')) {
      throw new Error('folderPath outside allowed prefix');
    }

    k = parts.join('/') + '/';

    // límite de S3: 1024 bytes en UTF-8
    const maxLen = opts?.maxLen ?? 1024;
    if (Buffer.byteLength(k, 'utf8') > maxLen) throw new Error('folderPath too long');

    return k;
  }
}
