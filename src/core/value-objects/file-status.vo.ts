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

  static copying(): FileStatus {
    return new FileStatus(FileStatusEnum.COPYING);
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

  isCopying(): boolean {
    return this.getValue() === FileStatusEnum.COPYING;
  }

  isActive(): boolean {
    // All statuses are now active since we delete failed records
    return true;
  }

  toString(): string {
    return this.getValue();
  }
}
