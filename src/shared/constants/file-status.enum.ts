export enum FileStatus {
  PENDING = 'PENDING',
  UPLOADING = 'UPLOADING',
  UPLOADED = 'UPLOADED',
  COPYING = 'COPYING',
}

export const FileStatusLabels: Record<FileStatus, string> = {
  [FileStatus.PENDING]: 'Pending',
  [FileStatus.UPLOADING]: 'Uploading',
  [FileStatus.UPLOADED]: 'Uploaded',
  [FileStatus.COPYING]: 'Copying',
};
