import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { XMLParser } from 'fast-xml-parser';

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

type ReqParams = Record<string, string | number | boolean | undefined>;

@Injectable()
export class MinioStorageService implements IStorageService {
  private readonly minioClient: Minio.Client;
  private readonly xml = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    trimValues: true,
  });

  constructor(
    private readonly configService: ConfigService,
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
  ) {
    this.logger.setContext(MinioStorageService.name);

    const minioConfig = this.configService.get<any>('storage.minio') ?? {};
    if (!minioConfig.endpoint) {
      throw new Error('Missing storage.minio.endpoint in configuration');
    }

    const endpointUrl = new URL(minioConfig.endpoint);
    const inferredPort = endpointUrl.port
      ? parseInt(endpointUrl.port, 10)
      : typeof minioConfig.port === 'number'
        ? minioConfig.port
        : endpointUrl.protocol === 'https:'
          ? 443
          : 80;

    const useSSL = endpointUrl.protocol === 'https:' || !!minioConfig.useSSL;

    this.minioClient = new Minio.Client({
      endPoint: endpointUrl.hostname,
      port: inferredPort,
      useSSL,
      accessKey: minioConfig.accessKey,
      secretKey: minioConfig.secretKey,
      region: minioConfig.region ?? 'us-east-1',
    });

    this.logger.log({
      message: 'MinIO Storage Service initialized',
      endpoint: endpointUrl.hostname,
      port: inferredPort,
      useSSL,
      region: minioConfig.region ?? 'us-east-1',
    });
  }

  // ============================================================================
  // PUBLIC API - MULTIPART (Create / Part URLs / List / Complete / Abort)
  // ============================================================================

  /** CreateMultipartUpload (vía URL firmada + fetch) */
  async initiateMultipartUpload(
    bucket: string,
    objectKey: string,
    contentType: string,
  ): Promise<IMultipartUploadResult> {
    try {
      this.logger.debug({ message: 'Initiating multipart upload', bucket, objectKey, contentType });
      this.validateBucketName(bucket);
      this.validateSecureObjectKey(objectKey);
      await this.ensureBucketExists(bucket);

      // CreateMultipartUpload => POST ?uploads
      const xml = await this.s3SignedXmlRequest(
        'POST',
        bucket,
        objectKey,
        { uploads: '' },
        undefined,
        {
          'Content-Type': contentType || 'application/octet-stream',
        },
      );

      // AWS nombra el nodo "InitiateMultipartUploadResult"
      const doc = this.xml.parse(xml);
      const uploadId =
        doc?.InitiateMultipartUploadResult?.UploadId ?? doc?.CreateMultipartUploadResult?.UploadId;
      if (!uploadId) throw new Error('CreateMultipartUpload: missing UploadId');

      this.logger.log({ message: 'Multipart upload initiated', bucket, objectKey, uploadId });

      return { uploadId };
    } catch (error) {
      this.logAndThrow(
        'Failed to initiate multipart upload',
        { bucket, objectKey, contentType },
        error,
      );
    }
  }

  /** Presigned URL para subir una parte (PUT ?partNumber=&uploadId=) */
  async generatePresignedPartUrl(
    bucket: string,
    objectKey: string,
    uploadId: string,
    partNumber: number,
    expirationSeconds: number,
  ): Promise<IPresignedUrlResult> {
    try {
      this.logger.debug({
        message: 'Generating presigned part URL',
        bucket,
        objectKey,
        uploadId,
        partNumber,
        expirationSeconds,
      });

      const url = await this.minioClient.presignedUrl(
        'PUT',
        bucket,
        objectKey,
        Math.min(expirationSeconds || 3600, 24 * 60 * 60),
        { uploadId, partNumber: String(partNumber) },
      );

      this.logger.log({ message: 'Presigned part URL generated', bucket, objectKey, partNumber });

      return { url };
    } catch (error) {
      this.logAndThrow(
        'Failed to generate presigned part URL',
        { bucket, objectKey, uploadId, partNumber },
        error,
      );
    }
  }

  /** ListParts (GET ?uploadId=…) con paginación */
  async listUploadParts(
    bucket: string,
    objectKey: string,
    uploadId: string,
  ): Promise<IListPartsResult> {
    try {
      this.logger.debug({ message: 'Listing multipart upload parts', bucket, objectKey, uploadId });

      const parts: IUploadPart[] = [];
      let marker = 0;
      let truncated = true;

      while (truncated) {
        const req: ReqParams = { uploadId, 'max-parts': 1000 };
        if (marker > 0) req['part-number-marker'] = marker;

        const xml = await this.s3SignedXmlRequest('GET', bucket, objectKey, req);
        const doc = this.xml.parse(xml);
        const result = doc?.ListPartsResult;
        if (!result) throw new Error('ListParts: invalid XML');

        const list = Array.isArray(result.Part) ? result.Part : result.Part ? [result.Part] : [];
        for (const p of list) {
          parts.push({
            PartNumber: Number(p.PartNumber),
            LastModified: p.LastModified ? new Date(p.LastModified) : undefined,
            ETag: (p.ETag || '').replace(/^"+|"+$/g, ''), // quitar comillas
            Size: Number(p.Size ?? 0),
          });
        }

        truncated = String(result.IsTruncated).toLowerCase() === 'true';
        marker = Number(result.NextPartNumberMarker ?? 0);
      }

      const res: IListPartsResult = {
        uploadId,
        parts,
        totalPartsCount: parts.length,
        completedPartsCount: parts.filter(p => !!p.ETag).length,
      };

      this.logger.log({
        message: 'Listed multipart upload parts',
        bucket,
        objectKey,
        uploadId,
        totalParts: res.totalPartsCount,
        completedParts: res.completedPartsCount,
      });

      return res;
    } catch (error) {
      this.logAndThrow(
        'Failed to list multipart upload parts',
        { bucket, objectKey, uploadId },
        error,
      );
    }
  }

  /** CompleteMultipartUpload (POST ?uploadId=…) */
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
        uploadId,
        partsCount: parts.length,
      });

      // Orden S3 por PartNumber ascendente
      const sorted = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);

      const quote = (etag: string) => (etag?.startsWith('"') ? etag : `"${etag}"`);
      const body =
        `<CompleteMultipartUpload>` +
        sorted
          .map(
            p =>
              `<Part><PartNumber>${p.PartNumber}</PartNumber><ETag>${quote(p.ETag)}</ETag></Part>`,
          )
          .join('') +
        `</CompleteMultipartUpload>`;

      const xml = await this.s3SignedXmlRequest('POST', bucket, objectKey, { uploadId }, body, {
        'Content-Type': 'application/xml',
      });

      const doc = this.xml.parse(xml);
      const etag = (
        doc?.CompleteMultipartUploadResult?.ETag || doc?.CompleteMultipartUploadResult?.ETag?.text
      )?.replace(/^"+|"+$/g, '');

      this.logger.log({ message: 'Multipart upload completed', bucket, objectKey, uploadId, etag });

      return { etag: etag || '' };
    } catch (error) {
      this.logAndThrow(
        'Failed to complete multipart upload',
        { bucket, objectKey, uploadId },
        error,
      );
    }
  }

  /** AbortMultipartUpload (DELETE ?uploadId=…) */
  async abortMultipartUpload(bucket: string, objectKey: string, uploadId: string): Promise<void> {
    try {
      this.logger.debug({ message: 'Aborting multipart upload', bucket, objectKey, uploadId });
      await this.s3SignedXmlRequest('DELETE', bucket, objectKey, { uploadId });
      this.logger.log({ message: 'Multipart upload aborted', bucket, objectKey, uploadId });
    } catch (error) {
      this.logAndThrow('Failed to abort multipart upload', { bucket, objectKey, uploadId }, error);
    }
  }

  // ============================================================================
  // PUBLIC API - OBJECT OPERATIONS
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

      // S3 requiere CopySource con "/" inicial y keys URL-encoded (excepto "/")
      const encodedSrc = encodeURIComponent(sourceKey).replace(/%2F/g, '/');
      const copySource = `/${sourceBucket}/${encodedSrc}`;

      await this.minioClient.copyObject(destinationBucket, destinationKey, copySource);

      this.logger.log({
        message: 'Object copied successfully',
        sourceBucket,
        sourceKey,
        destinationBucket,
        destinationKey,
      });
    } catch (error) {
      this.logAndThrow(
        'Failed to copy object',
        { sourceBucket, sourceKey, destinationBucket, destinationKey },
        error,
      );
    }
  }

  async deleteObject(bucket: string, objectKey: string): Promise<void> {
    try {
      this.logger.debug({ message: 'Deleting object', bucket, objectKey });
      await this.minioClient.removeObject(bucket, objectKey);
      this.logger.log({ message: 'Object deleted successfully', bucket, objectKey });
    } catch (error) {
      this.logAndThrow('Failed to delete object', { bucket, objectKey }, error);
    }
  }

  async deleteObjects(bucket: string, objectKeys: string[]): Promise<void> {
    try {
      this.logger.debug({
        message: 'Deleting multiple objects',
        bucket,
        objectCount: objectKeys.length,
      });
      if (objectKeys.length) await this.minioClient.removeObjects(bucket, objectKeys);
      this.logger.log({
        message: 'Multiple objects deleted successfully',
        bucket,
        objectCount: objectKeys.length,
      });
    } catch (error) {
      this.logAndThrow(
        'Failed to delete multiple objects',
        { bucket, objectCount: objectKeys.length },
        error,
      );
    }
  }

  async deleteObjectsByPrefix(bucket: string, prefix: string): Promise<number> {
    try {
      this.logger.debug({ message: 'Deleting objects by prefix', bucket, prefix });
      const objectKeys = await this.listObjectsByPrefix(bucket, prefix);
      if (objectKeys.length) await this.deleteObjects(bucket, objectKeys);
      this.logger.log({
        message: 'Objects deleted by prefix',
        bucket,
        prefix,
        deletedCount: objectKeys.length,
      });

      return objectKeys.length;
    } catch (error) {
      this.logAndThrow('Failed to delete objects by prefix', { bucket, prefix }, error);
    }
  }

  // ============================================================================
  // PUBLIC API - OBJECT METADATA & ACCESS
  // ============================================================================

  async objectExists(bucket: string, objectKey: string): Promise<boolean> {
    try {
      await this.minioClient.statObject(bucket, objectKey);

      return true;
    } catch {
      return false;
    }
  }

  async getObjectMetadata(
    bucket: string,
    objectKey: string,
  ): Promise<{ size: number; lastModified: Date; etag: string; contentType: string }> {
    try {
      this.logger.debug({ message: 'Getting object metadata', bucket, objectKey });
      const stat = await this.minioClient.statObject(bucket, objectKey);

      return {
        size: stat.size,
        lastModified: stat.lastModified,
        etag: (stat.etag ?? '').replace(/"/g, ''),
        contentType: stat.metaData?.['content-type'] || 'application/octet-stream',
      };
    } catch (error) {
      this.logAndThrow('Failed to get object metadata', { bucket, objectKey }, error);
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
      this.validateSecureObjectKey(objectKey);

      const maxExpiry = 24 * 60 * 60;
      const safeExpiry = Math.min(expirationSeconds || 3600, maxExpiry);

      const url = await this.minioClient.presignedGetObject(bucket, objectKey, safeExpiry);

      this.logger.log({ message: 'Presigned GET URL generated', bucket, objectKey });

      return { url };
    } catch (error) {
      this.logAndThrow(
        'Failed to generate presigned GET URL',
        { bucket, objectKey, expirationSeconds },
        error,
      );
    }
  }

  async listObjectsByPrefix(bucket: string, prefix: string): Promise<string[]> {
    try {
      this.logger.debug({ message: 'Listing objects by prefix', bucket, prefix });

      const objects: string[] = [];
      // Use recursive:true to get all objects under the prefix
      const stream = this.minioClient.listObjects(bucket, prefix, true);

      // API oficial: consumir mediante eventos 'data'/'error'/'end' (stream)
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (obj: any) => {
          if (obj?.name) {
            objects.push(obj.name);
          }
        });
        stream.on('error', (err: any) => reject(err));
        stream.on('end', () => resolve());
      });

      this.logger.log({
        message: 'Objects listed successfully',
        bucket,
        prefix,
        objectCount: objects.length,
      });

      return objects;
    } catch (error) {
      this.logAndThrow('Failed to list objects by prefix', { bucket, prefix }, error);
    }
  }

  /**
   * List objects and folders at a specific level (non-recursive)
   * This is better for directory-like browsing
   */
  async listObjectsV2(
    bucket: string,
    prefix: string,
  ): Promise<{ objects: string[]; prefixes: string[] }> {
    try {
      this.logger.debug({ message: 'Listing objects V2 (with prefixes)', bucket, prefix });

      const objects: string[] = [];
      const prefixes: string[] = [];

      // Use recursive:false to get folder prefixes
      const stream = this.minioClient.listObjectsV2(bucket, prefix, false);

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (obj: any) => {
          // Regular objects (files)
          if (obj?.name) {
            objects.push(obj.name);
          }
          // Folder prefixes
          if (obj?.prefix) {
            prefixes.push(obj.prefix);
          }
        });
        stream.on('error', (err: any) => reject(err));
        stream.on('end', () => resolve());
      });

      this.logger.log({
        message: 'Objects V2 listed successfully',
        bucket,
        prefix,
        objectCount: objects.length,
        prefixCount: prefixes.length,
        objects: objects.slice(0, 5),
        prefixes: prefixes.slice(0, 5),
      });

      return { objects, prefixes };
    } catch (error) {
      this.logAndThrow('Failed to list objects V2', { bucket, prefix }, error);
    }
  }

  // ============================================================================
  // PUBLIC API - OBJECT VISIBILITY (ACL) - no-op (control a nivel aplicación)
  // ============================================================================

  async setObjectPublic(bucket: string, objectKey: string): Promise<void> {
    this.logger.log({
      message: 'Object visibility is managed at application level (no storage changes)',
      bucket,
      objectKey,
    });
  }

  async setObjectPrivate(bucket: string, objectKey: string): Promise<void> {
    this.logger.log({
      message: 'Object visibility is managed at application level (no storage changes)',
      bucket,
      objectKey,
    });
  }

  // ============================================================================
  // PUBLIC API - BUCKETS & HEALTH
  // ============================================================================

  async bucketExists(bucket: string): Promise<boolean> {
    try {
      return await this.minioClient.bucketExists(bucket);
    } catch (error) {
      this.logger.error({
        message: 'Failed to check if bucket exists',
        bucket,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return false;
    }
  }

  async createBucket(bucket: string): Promise<void> {
    try {
      this.logger.debug({ message: 'Creating bucket', bucket });
      const region = this.configService.get('storage.minio.region') ?? 'us-east-1';
      await this.minioClient.makeBucket(bucket, region);
      this.logger.log({ message: 'Bucket created successfully', bucket, region });
    } catch (error) {
      this.logAndThrow('Failed to create bucket', { bucket }, error);
    }
  }

  async createFolder(bucket: string, folderPath: string): Promise<void> {
    try {
      await this.ensureBucketExists(bucket);

      // Normalize folder path - ensure it ends with /
      const key = this.normalizeFolderKey(folderPath);

      const meta: Record<string, string> = {
        'Content-Type': 'application/x-directory',
        // Si tu bucket/política exige SSE, descomenta una:
        // 'x-amz-server-side-encryption': 'AES256',
        // 'x-amz-server-side-encryption': 'aws:kms', // si usas KMS en MinIO
      };

      // Create folder by putting an empty object with the folder path
      // This creates a "folder marker" that most S3 clients recognize as a folder
      await this.minioClient.putObject(bucket, key, Buffer.alloc(0), 0, meta);

      this.logger.log({
        message: 'Folder created successfully',
        bucket,
        folderPath: key,
      });
    } catch (error) {
      this.logAndThrow('Failed to create folder', { bucket, folderPath }, error);
    }
  }

  async deleteFolder(bucket: string, folderPath: string): Promise<void> {
    try {
      // Normalize folder path - ensure it ends with /
      const normalizedPath = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;

      // First check if folder exists
      const exists = await this.folderExists(bucket, folderPath);
      if (!exists) {
        this.logger.warn({
          message: 'Folder does not exist, skipping deletion',
          bucket,
          folderPath: normalizedPath,
        });

        return;
      }

      // Delete all objects with this prefix (including the folder marker)
      const deletedCount = await this.deleteObjectsByPrefix(bucket, normalizedPath);

      this.logger.log({
        message: 'Folder deleted successfully',
        bucket,
        folderPath: normalizedPath,
        deletedObjectsCount: deletedCount,
      });
    } catch (error) {
      this.logAndThrow('Failed to delete folder', { bucket, folderPath }, error);
    }
  }

  async folderExists(bucket: string, folderPath: string): Promise<boolean> {
    try {
      // Normalize folder path - ensure it ends with /
      const normalizedPath = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;

      // Check if the folder marker exists
      try {
        await this.minioClient.statObject(bucket, normalizedPath);

        return true;
      } catch (statError: any) {
        // If folder marker doesn't exist, check if there are any objects with this prefix
        // This handles cases where folder was created implicitly by uploading files
        if (statError.code === 'NotFound') {
          const objects = await this.listObjectsByPrefix(bucket, normalizedPath);

          return objects.length > 0;
        }
        throw statError;
      }
    } catch (error) {
      this.logger.error({
        message: 'Failed to check folder existence',
        bucket,
        folderPath,
        error: error instanceof Error ? error.message : String(error),
      });

      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.minioClient.listBuckets();

      return true;
    } catch (error) {
      this.logger.error({
        message: 'MinIO health check failed',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return false;
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private async ensureBucketExists(bucket: string): Promise<void> {
    const exists = await this.bucketExists(bucket);
    if (!exists) {
      this.logger.log({ message: 'Bucket does not exist, creating it', bucket });
      await this.createBucket(bucket);
    }
  }

  /** Request S3 con URL firmada (devuelve XML como string cuando aplica) */
  private async s3SignedXmlRequest(
    method: 'GET' | 'POST' | 'DELETE',
    bucket: string,
    objectKey: string,
    reqParams: ReqParams = {},
    body?: string,
    headers?: Record<string, string>,
  ): Promise<string> {
    const url = await this.minioClient.presignedUrl(
      method,
      bucket,
      objectKey,
      300,
      Object.fromEntries(Object.entries(reqParams).map(([k, v]) => [k, String(v)])),
    );

    const res = await fetch(url, {
      method,
      headers: { ...(headers || {}) },
      body,
    });

    const text = await res.text();
    if (!res.ok) {
      // devolver el XML de error para debugging
      throw new Error(`S3 ${method} failed (${res.status}): ${text}`);
    }

    return text;
  }

  private logAndThrow(msg: string, ctx: Record<string, unknown>, error: unknown): never {
    this.logger.error({
      message: msg,
      ...ctx,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error instanceof Error ? error : new Error(String(error));
  }

  // ============================================================================
  // SECURITY VALIDATION
  // ============================================================================

  private validateSecureObjectKey(objectKey: string): void {
    if (!objectKey || objectKey.length === 0 || objectKey.length > 1024) {
      throw new Error('Object key must be between 1 and 1024 characters');
    }
    if (objectKey.includes('..'))
      throw new Error('Object key cannot contain parent directory references');
    if (objectKey.startsWith('/') || objectKey.endsWith('/'))
      throw new Error('Object key cannot start or end with slash');
    if (/[\x00-\x1f\x7f]/.test(objectKey))
      throw new Error('Object key cannot contain control characters');
    if (/[<>:"|?*]/.test(objectKey)) throw new Error('Object key contains forbidden characters');
    if (objectKey.includes('\x00')) throw new Error('Object key contains null bytes');

    const forbiddenPrefixes = [
      '.minio/',
      '.minio.sys/',
      'minio/',
      'system/',
      'config/',
      'admin/',
      'bucket-policy',
      'bucket-lifecycle',
      'bucket-quota',
    ];
    const normalizedKey = objectKey.toLowerCase();
    for (const prefix of forbiddenPrefixes) {
      if (normalizedKey.startsWith(prefix)) {
        throw new Error(`Object key accesses forbidden system directory: ${prefix}`);
      }
    }
  }

  private validateBucketName(bucketName: string): void {
    if (bucketName.length < 3 || bucketName.length > 63) {
      throw new Error('Bucket name must be between 3 and 63 characters');
    }
    if (!/^[a-z0-9.-]+$/.test(bucketName)) {
      throw new Error('Bucket name can only contain lowercase letters, numbers, dots, and hyphens');
    }
    if (bucketName.startsWith('.') || bucketName.endsWith('.')) {
      throw new Error('Bucket name cannot start or end with a dot');
    }
    if (bucketName.includes('..')) {
      throw new Error('Bucket name cannot contain consecutive dots');
    }
    if (/^\d+\.\d+\.\d+\.\d+$/.test(bucketName)) {
      throw new Error('Bucket name cannot be formatted as an IP address');
    }
    const reserved = ['admin', 'api', 'www', 'ftp', 'mail', 'pop', 'pop3', 'imap', 'smtp'];
    if (reserved.includes(bucketName)) throw new Error('Bucket name uses a reserved word');
  }

  private normalizeFolderKey(input: string): string {
    if (!input || typeof input !== 'string') throw new Error('folderPath required');

    let k = input;
    try {
      k = decodeURIComponent(k);
    } catch {}
    k = k.replace(/\\/g, '/'); // backslashes -> slash
    k = k.replace(/\/+/g, '/'); // colapsa //
    k = k.replace(/^\/+|\/+$/g, ''); // quita slashes al inicio/fin

    // no absolutos/UNC/drive
    if (k.startsWith('/') || k.startsWith('//') || /^[a-zA-Z]:/.test(k)) {
      throw new Error('folderPath must be relative');
    }

    // niega "." y ".."
    const parts = k.split('/').filter(Boolean);
    for (const p of parts) {
      if (p === '.' || p === '..') throw new Error('path traversal detected');
    }

    // termina en "/"
    k = parts.join('/') + '/';

    // tamaño máximo de key en S3/MinIO ~1024
    if (k.length > 1024) throw new Error('folderPath too long');

    return k;
  }

  // (opcional) útil si necesitas inferir el tipo a partir del nombre de archivo
  private guessMimeTypeFromFileName(fileName: string): string {
    const extension = fileName.toLowerCase().split('.').pop() || '';
    const mimeTypes: Record<string, string> = {
      // Images
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      bmp: 'image/bmp',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      ico: 'image/x-icon',
      // Documents
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain',
      rtf: 'application/rtf',
      // Archives
      zip: 'application/zip',
      rar: 'application/x-rar-compressed',
      '7z': 'application/x-7z-compressed',
      tar: 'application/x-tar',
      gz: 'application/gzip',
      // Audio
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      flac: 'audio/flac',
      // Video
      mp4: 'video/mp4',
      avi: 'video/x-msvideo',
      mov: 'video/quicktime',
      wmv: 'video/x-ms-wmv',
      mkv: 'video/x-matroska',
      // Web
      html: 'text/html',
      htm: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      json: 'application/json',
      xml: 'application/xml',
      // Other
      csv: 'text/csv',
    };

    return mimeTypes[extension] || 'application/octet-stream';
  }
}
