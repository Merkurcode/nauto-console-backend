export enum FileStatus {
  PENDING = 'PENDING',
  UPLOADING = 'UPLOADING',
  UPLOADED = 'UPLOADED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
  DELETED = 'DELETED',
}

export const FileStatusLabels: Record<FileStatus, string> = {
  [FileStatus.PENDING]: 'Pending',
  [FileStatus.UPLOADING]: 'Uploading',
  [FileStatus.UPLOADED]: 'Uploaded',
  [FileStatus.FAILED]: 'Failed',
  [FileStatus.CANCELED]: 'Canceled',
  [FileStatus.DELETED]: 'Deleted',
};
