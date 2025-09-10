/**
 * Storage service interface for S3/MinIO operations
 *
 * This interface defines the contract for cloud storage operations,
 * including multipart uploads, object management, and ACL operations.
 *
 * Following Clean Architecture principles, this interface is defined
 * in the domain layer and implemented in the infrastructure layer.
 */

import Stream from 'node:stream';

export interface ICompletedPart {
  ETag: string;
  PartNumber: number;
}

export interface IMultipartUploadResult {
  uploadId: string;
}

export interface ICompleteUploadResult {
  etag?: string;
}

export interface IUploadPart {
  PartNumber: number;
  LastModified?: Date;
  ETag?: string;
  Size?: number;
}

export interface IListPartsResult {
  uploadId: string;
  parts: IUploadPart[];
  totalPartsCount: number;
  completedPartsCount: number;
}

export interface IPresignedUrlResult {
  url: string;
}

// src/core/dtos/upload-status.dto.ts
export interface IUploadStatusResult {
  uploadId: string;
  uploadedBytes: number;
  parts: Array<{ partNumber: number; size: number; etag: string }>;
  totalPartsCount: number; // detectadas en ListParts
  completedPartsCount: number; // con ETag presente
  nextPartNumber: number; // sugerencia (primer hueco o último+1)
  maxBytes: number;
  remainingBytes: number;
  canComplete: boolean; // total <= maxBytes (si maxBytes está definido)
}

export interface IStorageService {
  // Multipart upload operations
  initiateMultipartUpload(
    bucket: string,
    objectKey: string,
    contentType: string,
    maxBytes: number,
    isPublic: boolean,
  ): Promise<IMultipartUploadResult>;

  getUploadStatus(
    bucket: string,
    objectKey: string,
    uploadId: string,
    maxBytes: number,
  ): Promise<IUploadStatusResult>;

  generatePresignedPartUrl(
    bucket: string,
    objectKey: string,
    uploadId: string,
    partNumber: number,
    expirationSeconds: number,
    declaredPartSizeBytes: number, // tamaño declarado para ESTA parte
    maxBytes: number, // permite override por upload
  ): Promise<IPresignedUrlResult>;

  completeMultipartUpload(
    bucket: string,
    objectKey: string,
    uploadId: string,
    parts: ICompletedPart[],
    maxBytes: number,
  ): Promise<ICompleteUploadResult>;

  abortMultipartUpload(bucket: string, objectKey: string, uploadId: string): Promise<void>;

  listUploadParts(bucket: string, objectKey: string, uploadId: string): Promise<IListPartsResult>;

  // Object operations
  moveObject(
    sourceBucket: string,
    sourceKey: string,
    destinationBucket: string,
    destinationKey: string,
  ): Promise<void>;

  deleteObject(bucket: string, objectKey: string): Promise<void>;

  deleteObjects(bucket: string, objectKeys: string[]): Promise<void>;

  objectExists(bucket: string, objectKey: string): Promise<boolean>;

  getObjectMetadata(
    bucket: string,
    objectKey: string,
  ): Promise<{
    size: number;
    lastModified: Date;
    etag: string;
    contentType: string;
  }>;

  getObjectStream(bucket: string, objectKey: string): Promise<Stream.Readable>;

  // Access control operations
  setObjectPublic(bucket: string, objectKey: string): Promise<void>;

  setObjectPrivate(bucket: string, objectKey: string): Promise<void>;

  generatePresignedGetUrl(
    bucket: string,
    objectKey: string,
    expirationSeconds: number,
  ): Promise<IPresignedUrlResult>;

  // Folder/prefix operations
  listObjectsByPrefix(bucket: string, prefix: string): Promise<string[]>;

  listObjectsV2?(
    bucket: string,
    prefix: string,
  ): Promise<{ objects: string[]; prefixes: string[] }>;

  deleteObjectsByPrefix(bucket: string, prefix: string): Promise<number>;

  createFolder(bucket: string, folderPath: string): Promise<void>;

  deleteFolder(bucket: string, folderPath: string): Promise<void>;

  folderExists(bucket: string, folderPath: string): Promise<boolean>;

  // Bucket operations
  bucketExists(bucket: string): Promise<boolean>;

  createBucket(bucket: string): Promise<void>;

  // Health check
  healthCheck(): Promise<boolean>;
}
