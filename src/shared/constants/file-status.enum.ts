export enum FileStatus {
  PENDING = 'PENDING',
  UPLOADING = 'UPLOADING',
  UPLOADED = 'UPLOADED',
  COPYING = 'COPYING',
  PROCESSING = 'PROCESSING',
  ERASING = 'ERASING',
}

export const FileStatusLabels: Record<FileStatus, string> = {
  [FileStatus.PENDING]: 'Pending',
  [FileStatus.UPLOADING]: 'Uploading',
  [FileStatus.UPLOADED]: 'Uploaded',
  [FileStatus.COPYING]: 'Copying',
  [FileStatus.PROCESSING]: 'Processing',
  [FileStatus.ERASING]: 'Erasing',
};
