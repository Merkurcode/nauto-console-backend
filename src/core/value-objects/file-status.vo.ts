import { ValueObject } from './base.vo';
import { FileStatus as FileStatusEnum } from '@shared/constants/file-status.enum';

export class FileStatus extends ValueObject<FileStatusEnum> {
  constructor(value: FileStatusEnum) {
    super(value);
    this.validate();
  }

  protected validate(): void {
    const value = this.getValue();
    if (!Object.values(FileStatusEnum).includes(value)) {
      throw new Error(`Invalid file status: ${value}`);
    }
  }

  static fromString(status: string): FileStatus {
    const upperStatus = status.toUpperCase();
    if (!Object.values(FileStatusEnum).includes(upperStatus as FileStatusEnum)) {
      throw new Error(`Invalid file status: ${status}`);
    }

    return new FileStatus(upperStatus as FileStatusEnum);
  }

  static pending(): FileStatus {
    return new FileStatus(FileStatusEnum.PENDING);
  }

  static uploading(): FileStatus {
    return new FileStatus(FileStatusEnum.UPLOADING);
  }

  static uploaded(): FileStatus {
    return new FileStatus(FileStatusEnum.UPLOADED);
  }

  static failed(): FileStatus {
    return new FileStatus(FileStatusEnum.FAILED);
  }

  static canceled(): FileStatus {
    return new FileStatus(FileStatusEnum.CANCELED);
  }

  static deleted(): FileStatus {
    return new FileStatus(FileStatusEnum.DELETED);
  }

  isPending(): boolean {
    return this.getValue() === FileStatusEnum.PENDING;
  }

  isUploading(): boolean {
    return this.getValue() === FileStatusEnum.UPLOADING;
  }

  isUploaded(): boolean {
    return this.getValue() === FileStatusEnum.UPLOADED;
  }

  isFailed(): boolean {
    return this.getValue() === FileStatusEnum.FAILED;
  }

  isCanceled(): boolean {
    return this.getValue() === FileStatusEnum.CANCELED;
  }

  isDeleted(): boolean {
    return this.getValue() === FileStatusEnum.DELETED;
  }

  isActive(): boolean {
    const value = this.getValue();

    return (
      value === FileStatusEnum.PENDING ||
      value === FileStatusEnum.UPLOADING ||
      value === FileStatusEnum.UPLOADED
    );
  }

  toString(): string {
    return this.getValue();
  }
}
