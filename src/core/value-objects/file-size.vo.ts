import { ValueObject } from './base.vo';
import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

export class FileSize extends ValueObject<number> {
  private static readonly MIN_FILE_SIZE = 1; // 1 byte
  private static readonly SIZES = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  constructor(value: number) {
    super(value);
    this.validate();
  }

  protected validate(): void {
    if (typeof this.value !== 'number' || !Number.isInteger(this.value)) {
      throw new InvalidValueObjectException('File size must be a valid integer', 'FileSize');
    }

    if (this.value < FileSize.MIN_FILE_SIZE) {
      throw new InvalidValueObjectException(
        `File size must be at least ${FileSize.MIN_FILE_SIZE} byte`,
        'FileSize',
      );
    }
  }

  public static create(value: number): FileSize {
    return new FileSize(value);
  }

  /**
   * Creates FileSize from bytes
   */
  public static fromBytes(bytes: number): FileSize {
    return new FileSize(bytes);
  }

  /**
   * Creates FileSize from kilobytes
   */
  public static fromKilobytes(kb: number): FileSize {
    return new FileSize(Math.round(kb * 1024));
  }

  /**
   * Creates FileSize from megabytes
   */
  public static fromMegabytes(mb: number): FileSize {
    return new FileSize(Math.round(mb * 1024 * 1024));
  }

  /**
   * Creates FileSize from gigabytes
   */
  public static fromGigabytes(gb: number): FileSize {
    return new FileSize(Math.round(gb * 1024 * 1024 * 1024));
  }

  /**
   * Returns size in bytes
   */
  public getBytes(): number {
    return this.value;
  }

  /**
   * Returns size in kilobytes
   */
  public getKilobytes(): number {
    return this.value / 1024;
  }

  /**
   * Returns size in megabytes
   */
  public getMegabytes(): number {
    return this.value / (1024 * 1024);
  }

  /**
   * Returns size in gigabytes
   */
  public getGigabytes(): number {
    return this.value / (1024 * 1024 * 1024);
  }

  /**
   * Formats the file size in human-readable format
   */
  public format(): string {
    return this.formatBytes(this.value);
  }

  /**
   * Checks if file size exceeds the given limit
   */
  public exceeds(limit: FileSize): boolean {
    return this.value > limit.value;
  }

  /**
   * Adds two file sizes
   */
  public add(other: FileSize): FileSize {
    return new FileSize(this.value + other.value);
  }

  /**
   * Subtracts two file sizes
   */
  public subtract(other: FileSize): FileSize {
    const result = this.value - other.value;

    return new FileSize(Math.max(0, result));
  }

  /**
   * Compares with another file size
   * Returns: -1 if smaller, 0 if equal, 1 if larger
   */
  public compare(other: FileSize): number {
    if (this.value < other.value) return -1;
    if (this.value > other.value) return 1;

    return 0;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return (
      parseFloat((bytes / Math.pow(k, i)).toFixed(2)) +
      ' ' +
      (i >= FileSize.SIZES.length ? '?' : FileSize.SIZES[i])
    );
  }

  public toString(): string {
    return this.format();
  }
}
