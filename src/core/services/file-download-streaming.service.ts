/* eslint-disable @typescript-eslint/no-explicit-any */
import { QueryBus } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { Readable } from 'node:stream';
import { parse as parseUrl } from 'node:url';
import { extname } from 'node:path';
import { createHash } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import { ILogger } from '@core/interfaces/logger.interface';
import { ICompletedPart, IStorageService } from '@core/repositories/storage.service.interface';
import { IBulkProcessingContext } from './bulk-processing.service';
import { LOGGER_SERVICE, STORAGE_SERVICE } from '@shared/constants/tokens';
import {
  BulkProcessingFileDownloadException,
  BulkProcessingS3StorageException,
} from '@core/exceptions/bulk-processing.exceptions';
import {
  GetUserStorageQuotaQuery,
  IGetUserStorageQuotaResponse,
} from '@application/queries/storage/get-user-storage-quota.query';

export interface IFileDownloadResult {
  success: boolean;
  originalUrl: string;
  downloadedFileName: string;
  storagePath: string;
  fileSize: number;
  mimeType?: string;
  etag?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface IFileDownloadOptions {
  baseStoragePath: string;
  allowedExtensions?: string[];
  maxFileSize?: number; // límite preventivo
  timeout?: number; // ms
  retryAttempts?: number; // reintentos
  retryDelay?: number; // ms (backoff exponencial)
  generateUniqueNames?: boolean;
  preserveExtension?: boolean;
  metadata?: Record<string, any>;
}

export interface IBulkFileDownloadResult {
  totalFiles: number;
  successfulDownloads: number;
  failedDownloads: number;
  results: IFileDownloadResult[];
  totalSize: number;
  metadata?: Record<string, any>;
}

@Injectable()
export class FileDownloadStreamingService {
  private static readonly DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB (>= 5 MiB para multipart S3)
  private static readonly MAX_CONSEC_ERRORS = 5;

  constructor(
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,
    private readonly configService: ConfigService,
    private readonly queryBus: QueryBus,
  ) {
    this.logger.setContext(FileDownloadStreamingService.name);
  }

  // ========= API PÚBLICA =========

  async downloadFilesBatch(
    context: IBulkProcessingContext,
    urls: string[],
    options: IFileDownloadOptions,
    concurrency = 1, // muy conservador para 512 MB
  ): Promise<IBulkFileDownloadResult> {
    const res: IBulkFileDownloadResult = {
      totalFiles: urls.length,
      successfulDownloads: 0,
      failedDownloads: 0,
      results: [],
      totalSize: 0,
      metadata: options.metadata ? { ...options.metadata } : {},
    };

    if (!urls.length) {
      this.logger.warn('No URLs provided for download');

      return res;
    }

    const batchSize = Math.max(1, concurrency);
    for (let i = 0; i < urls.length; i += batchSize) {
      // Check for cancellation before each batch to avoid more loops
      await context?.cancellationChecker?.();

      const group = urls.slice(i, i + batchSize);
      const settled = await Promise.allSettled(
        group.map(u => this.downloadSingleFileWithRetry(u, options, context)),
      );

      for (const s of settled) {
        if (s.status === 'fulfilled') {
          res.results.push(s.value);
          if (s.value.success) {
            res.successfulDownloads++;
            res.totalSize += s.value.fileSize;
          } else {
            res.failedDownloads++;
          }
        } else {
          const msg = s.reason instanceof Error ? s.reason.message : String(s.reason);
          res.results.push({
            success: false,
            originalUrl: 'unknown',
            downloadedFileName: '',
            storagePath: '',
            fileSize: 0,
            error: msg,
          });
          res.failedDownloads++;
        }
      }

      const processed = Math.min(i + batchSize, urls.length);
      this.logger.debug(`Batch progress: ${processed}/${urls.length}`);
      if (i + batchSize < urls.length) await new Promise(r => setTimeout(r, 100));
    }

    this.logger.log(
      `Batch download done: ${res.successfulDownloads}/${res.totalFiles} ok, ` +
        `total ${(res.totalSize / 1024 / 1024).toFixed(2)} MB`,
    );

    return res;
  }

  // ========= Internos =========

  private async downloadSingleFileWithRetry(
    url: string,
    options: IFileDownloadOptions,
    context: IBulkProcessingContext,
  ): Promise<IFileDownloadResult> {
    const attempts = options.retryAttempts ?? 3;
    const baseDelay = options.retryDelay ?? 1000;
    let lastErr: Error | null = null;

    for (let i = 1; i <= attempts; i++) {
      // Check for cancellation before each retry attempt
      await context?.cancellationChecker?.();

      try {
        return await this.downloadSingleFile(url, options, context);
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        if (i < attempts) {
          const delay = baseDelay * Math.pow(2, i - 1);
          this.logger.warn(
            `Download attempt ${i} failed (${url}): ${lastErr.message}. Retrying in ${delay}ms...`,
          );
          await new Promise(r => setTimeout(r, delay));
        } else {
          this.logger.error(`All ${attempts} attempts failed for ${url}: ${lastErr.message}`);
        }
      }
    }

    return {
      success: false,
      originalUrl: url,
      downloadedFileName: '',
      storagePath: '',
      fileSize: 0,
      error: lastErr?.message ?? 'Unknown error',
      metadata: options.metadata,
    };
  }

  /**
   * Descarga una URL y sube a S3 por multipart en streaming (sin buffer total).
   */
  private async downloadSingleFile(
    url: string,
    options: IFileDownloadOptions,
    context: IBulkProcessingContext,
  ): Promise<IFileDownloadResult> {
    // 1) Validaciones básicas
    const parsed = parseUrl(url);
    if (!parsed.protocol || !parsed.hostname) {
      throw new BulkProcessingFileDownloadException(url, 'Invalid URL format');
    }

    const originalExt = extname(parsed.pathname ?? '') || '';
    this.ensureAllowedExtension(url, originalExt, options);

    const fileName = this.generateFileName(url, originalExt, options);
    const storagePath = `${options.baseStoragePath}/${fileName}`;
    const bucket = this.configService.get<string>('storage.defaultBucket', 'files');
    const userAgent = this.configService.get<string>('userAgent', null);

    // 2) HTTP GET (streaming) con timeout
    const timeout = options.timeout ?? 30_000;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeout);
    let response: Response;
    try {
      response = await fetch(url, {
        signal: ac.signal,
        headers: userAgent ? { 'User-Agent': userAgent } : undefined,
      });
    } finally {
      clearTimeout(t);
    }
    if (!response.ok) {
      throw new BulkProcessingFileDownloadException(
        url,
        `HTTP ${response.status} ${response.statusText}`,
      );
    }
    if (!response.body) {
      throw new BulkProcessingFileDownloadException(url, 'No response body received');
    }

    const mimeType = response.headers.get('content-type') ?? 'application/octet-stream';
    const clHeader = response.headers.get('content-length');
    const declaredSize = clHeader ? Number(clHeader) : undefined;
    const expectedMaxBytes =
      declaredSize && !isNaN(declaredSize) && declaredSize > 0
        ? declaredSize
        : (options.maxFileSize ?? undefined);

    // Log/validación tamaño declarado vs límite opcional
    if (options.maxFileSize) {
      this.logger.debug(
        `File size validation enabled for ${url}: limit ${(options.maxFileSize / 1024 / 1024).toFixed(1)} MB` +
          (declaredSize
            ? `, declared ${(declaredSize / 1024 / 1024).toFixed(1)} MB`
            : ', declared size unknown'),
      );
      if (declaredSize && declaredSize > options.maxFileSize) {
        const msg = `Aborted upload for ${url} due to size limit exceeded (${(declaredSize / 1024 / 1024).toFixed(1)} MB > ${(options.maxFileSize / 1024 / 1024).toFixed(1)} MB)`;
        this.logger.warn(msg);

        return {
          success: false,
          originalUrl: url,
          downloadedFileName: '',
          storagePath,
          fileSize: declaredSize,
          error: msg,
          metadata: options.metadata,
        };
      }
    }

    // Chequeo de cuota: si conocemos tamaño esperado, validamos upfront;
    // si no, haremos verificación PROGRESIVA más abajo.
    const quota: IGetUserStorageQuotaResponse = await this.queryBus.execute(
      new GetUserStorageQuotaQuery(context.userId),
    );
    if (expectedMaxBytes && BigInt(expectedMaxBytes) > BigInt(quota.availableStorageBytes)) {
      const remainMB = Number(quota.availableStorageBytes) / 1024 / 1024;
      const msg = `Aborted: not enough quota. Remaining ${remainMB.toFixed(1)} MB.`;
      this.logger.warn(msg);

      return {
        success: false,
        originalUrl: url,
        downloadedFileName: '',
        storagePath,
        fileSize: expectedMaxBytes,
        error: msg,
        metadata: options.metadata,
      };
    }

    // 3) Iniciar multipart upload (sin pasar 0 como límite)
    const { uploadId } = await this.storageService.initiateMultipartUpload(
      bucket,
      storagePath,
      mimeType,
      expectedMaxBytes,
      true,
    );

    // 4) Stream → partes fijas (8 MiB) sin Buffer.concat O(n²)
    const chunkSize = FileDownloadStreamingService.DEFAULT_CHUNK_SIZE; // 8 MiB
    const reader = Readable.fromWeb(response.body as any);

    let partNumber = 1;
    let totalBytes = 0;
    const completedParts: Array<ICompletedPart> = [];

    // Acumulador eficiente
    const pending: Buffer[] = [];
    let pendingLen = 0;

    try {
      for await (const chunk of reader) {
        await context?.cancellationChecker?.();
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += buf.length;

        // Límite de tamaño progresivo (si existe)
        if (options.maxFileSize && totalBytes > options.maxFileSize) {
          try {
            await this.storageService.abortMultipartUpload(bucket, storagePath, uploadId);
          } catch (abortError) {
            this.logger.error(`Failed to abort multipart upload for ${url}: ${abortError}`);
          }
          throw new BulkProcessingFileDownloadException(
            url,
            `File size exceeds limit. Downloaded ${totalBytes} bytes, limit is ${options.maxFileSize} bytes (${(options.maxFileSize / 1024 / 1024).toFixed(1)} MB)`,
          );
        }

        // Chequeo progresivo de cuota si no conocíamos tamaño
        if (!expectedMaxBytes && BigInt(totalBytes) > BigInt(quota.availableStorageBytes)) {
          try {
            await this.storageService.abortMultipartUpload(bucket, storagePath, uploadId);
          } catch {}
          const remainMB = Number(quota.availableStorageBytes) / 1024 / 1024;
          throw new BulkProcessingFileDownloadException(
            url,
            `Quota exceeded during download. Remaining ${remainMB.toFixed(1)} MB`,
          );
        }

        // Encolar sin copiar
        pending.push(buf);
        pendingLen += buf.length;

        // Servir partes exactas de chunkSize
        while (pendingLen >= chunkSize) {
          await context?.cancellationChecker?.();

          let need = chunkSize;
          const take: Buffer[] = [];

          // Tomar exactamente chunkSize bytes de pending, sin realloc masivo
          while (need > 0) {
            const head = pending[0];
            if (head.length <= need) {
              take.push(head);
              pending.shift();
              pendingLen -= head.length;
              need -= head.length;
            } else {
              take.push(head.subarray(0, need));
              pending[0] = head.subarray(need);
              pendingLen -= need;
              need = 0;
            }
          }

          const toSend = take.length === 1 ? take[0] : Buffer.concat(take, chunkSize);
          const etag = await this.uploadPart(
            bucket,
            storagePath,
            uploadId,
            partNumber,
            toSend,
            expectedMaxBytes ?? 0, // tu firma actual espera número; si puedes, pásalo como undefined
          );
          completedParts.push({ ETag: etag, PartNumber: partNumber });
          partNumber++;
        }
      }

      // Validar respuesta vacía (0 bytes)
      if (totalBytes === 0) {
        try {
          await this.storageService.abortMultipartUpload(bucket, storagePath, uploadId);
        } catch {}
        throw new BulkProcessingFileDownloadException(url, 'Empty response body (0 bytes)');
      }

      // Última parte (puede ser < 5 MiB)
      if (pendingLen > 0) {
        const last = pending.length === 1 ? pending[0] : Buffer.concat(pending, pendingLen);
        const etag = await this.uploadPart(
          bucket,
          storagePath,
          uploadId,
          partNumber,
          last,
          expectedMaxBytes ?? 0,
        );
        completedParts.push({ ETag: etag, PartNumber: partNumber });
      }
    } catch (err) {
      try {
        await this.storageService.abortMultipartUpload(bucket, storagePath, uploadId);
      } catch {}
      throw err;
    }

    // 5) Completar multipart
    const uploadResult = await this.storageService.completeMultipartUpload(
      bucket,
      storagePath,
      uploadId,
      completedParts,
      totalBytes,
    );

    this.logger.debug(
      `Downloaded ${url} -> s3://${bucket}/${storagePath} (${(totalBytes / 1024 / 1024).toFixed(2)} MB)`,
    );

    return {
      success: true,
      originalUrl: url,
      downloadedFileName: fileName,
      storagePath,
      fileSize: totalBytes,
      mimeType,
      etag: uploadResult.etag,
      metadata: options.metadata,
    };
  }

  private async uploadPart(
    bucket: string,
    storagePath: string,
    uploadId: string,
    partNumber: number,
    bodyBuf: Buffer,
    maxFileSize: number,
  ): Promise<string> {
    const presigned = await this.storageService.generatePresignedPartUrl(
      bucket,
      storagePath,
      uploadId,
      partNumber,
      300, // exp 5 min
      bodyBuf.length, // declaredPartSizeBytes (tamaño del chunk actual)
      maxFileSize, // maxBytes (límite total del archivo)
    );

    const putRes = await fetch(presigned.url, {
      method: 'PUT',
      body: bodyBuf,
      headers: {
        'Content-Length': String(bodyBuf.length),
        // El Content-Type real da igual para parts; algunos proxies prefieren application/octet-stream
        'Content-Type': 'application/octet-stream',
      },
    });

    if (!putRes.ok) {
      throw new BulkProcessingS3StorageException(
        'UPLOAD_PART',
        storagePath,
        `Part ${partNumber} upload failed: HTTP ${putRes.status} ${putRes.statusText}`,
      );
    }

    const etag = putRes.headers.get('etag');
    if (!etag) {
      throw new BulkProcessingS3StorageException(
        'UPLOAD_PART',
        storagePath,
        `Missing ETag for part ${partNumber}`,
      );
    }

    return etag.replace(/^"+|"+$/g, ''); // normaliza ETag sin comillas
  }

  // -------- Helpers --------

  private ensureAllowedExtension(url: string, originalExt: string, options: IFileDownloadOptions) {
    if (options.allowedExtensions?.length) {
      const normalized = originalExt.toLowerCase();
      const allowed = options.allowedExtensions.map(e =>
        e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`,
      );
      if (!allowed.includes(normalized)) {
        throw new BulkProcessingFileDownloadException(
          url,
          `Extension '${originalExt}' not allowed. Allowed: ${allowed.join(', ')}`,
        );
      }
    }
  }

  private generateFileName(
    url: string,
    originalExt: string,
    options: IFileDownloadOptions,
  ): string {
    if (!options.generateUniqueNames) {
      let name = parseUrl(url).pathname?.split('/').pop() || 'downloaded-file';
      try {
        name = decodeURIComponent(name);
      } catch {}

      return options.preserveExtension !== false && originalExt ? name : name + originalExt;
    }
    const hash = createHash('md5')
      .update(url + Date.now())
      .digest('hex')
      .slice(0, 8);
    const ext = options.preserveExtension !== false && originalExt ? originalExt : '';

    return `file-${hash}${ext}`;
  }

  static parseUrlsFromString(urlsString: string): string[] {
    if (!urlsString || typeof urlsString !== 'string') return [];

    return urlsString
      .split(';')
      .map(s => s.trim())
      .filter(Boolean)
      .filter(FileDownloadStreamingService.isValidUrl);
  }

  private static isValidUrl(url: string): boolean {
    try {
      const p = parseUrl(url);

      return !!(p.protocol && p.hostname);
    } catch {
      return false;
    }
  }

  //estimateMemoryUsage(
  //  urls: string[],
  //  options: IFileDownloadOptions,
  //): { estimatedMemoryMB: number; recommendedConcurrency: number; warnings: string[] } {
  //  const maxFileSize = options.maxFileSize ?? 50 * 1024 * 1024;
  //  // Usamos chunk de 8 MiB → memoria por descarga ~= 8-12 MiB (buffers + overhead)
  //  const perTaskMB = (FileDownloadStreamingService.DEFAULT_CHUNK_SIZE * 1.5) / (1024 * 1024);
  //  const available = 200; // suposición conservadora para 512 MB
  //  const recommended = Math.max(1, Math.floor(available / perTaskMB));
  //  const worstCaseMB = (maxFileSize * urls.length) / (1024 * 1024);
  //
  //  const warnings: string[] = [];
  //  if (worstCaseMB > available) {
  //    warnings.push(
  //      `Worst-case (${worstCaseMB.toFixed(1)} MB) exceeds available memory. Prefer batches.`,
  //    );
  //  }
  //
  //  return { estimatedMemoryMB: worstCaseMB, recommendedConcurrency: recommended, warnings };
  //}
}
