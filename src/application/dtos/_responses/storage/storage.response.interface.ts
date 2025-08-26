export interface IInitiateMultipartUploadResponse {
  fileId: string;
  uploadId: string;
  objectKey: string;
}

export interface IGeneratePartUrlResponse {
  url: string;
  partNumber: number;
  expirationSeconds: number;
}

export interface IFileResponse {
  id: string;
  filename: string;
  originalName: string;
  path: string;
  objectKey: string;
  mimeType: string;
  size: number;
  bucket: string;
  userId: string | null;
  isPublic: boolean;
  status: string;
  uploadId: string | null;
  etag: string | null;
  createdAt: Date;
  updatedAt: Date;
  signedUrl?: string;
  signedUrlExpiresAt?: Date;
}

export interface IGetFileSignedUrlResponse {
  url: string;
  expirationSeconds: number;
  isPublic: boolean;
}

export interface IGetUploadStatusResponse {
  fileId: string;
  status: string;
  progress: number;
  completedParts: number;
  totalParts: number | null;
  uploadId: string | null;
  message: string | null;
}

export interface IGetUserFilesResponse {
  files: IFileResponse[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface IGetUserStorageQuotaResponse {
  userId: string;
  totalUsed: number;
  totalQuota: number;
  availableQuota: number;
  filesCount: number;
  formattedUsed: string;
  formattedQuota: string;
  formattedAvailable: string;
  usagePercentage: number;
}

export interface ICreateFolderResponse {
  path: string;
}

export interface IDirectoryItem {
  id?: string; // File ID (only present for files, not folders)
  name: string;
  type: 'file' | 'folder';
  path: string;
  size?: number;
  mimeType?: string;
  createdAt?: Date;
  updatedAt?: Date;
  status?: string;
  signedUrl?: string;
  signedUrlExpiresAt?: Date;
}

export interface IDirectoryContentsResponse {
  items: IDirectoryItem[];
  currentPath: string;
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}
