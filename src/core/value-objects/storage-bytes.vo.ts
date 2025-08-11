export class StorageBytes {
  private constructor(private readonly bytes: bigint) {
    if (bytes < BigInt(0)) {
      throw new Error('Storage bytes cannot be negative');
    }
  }

  static fromBytes(bytes: bigint): StorageBytes {
    return new StorageBytes(bytes);
  }

  static fromMegabytes(megabytes: number): StorageBytes {
    if (megabytes < 0) {
      throw new Error('Storage megabytes cannot be negative');
    }

    return new StorageBytes(BigInt(megabytes * 1024 * 1024));
  }

  static fromGigabytes(gigabytes: number): StorageBytes {
    if (gigabytes < 0) {
      throw new Error('Storage gigabytes cannot be negative');
    }

    return new StorageBytes(BigInt(gigabytes * 1024 * 1024 * 1024));
  }

  getValue(): bigint {
    return this.bytes;
  }

  toMegabytes(): number {
    return Number(this.bytes) / (1024 * 1024);
  }

  toGigabytes(): number {
    return Number(this.bytes) / (1024 * 1024 * 1024);
  }

  add(other: StorageBytes): StorageBytes {
    return new StorageBytes(this.bytes + other.bytes);
  }

  subtract(other: StorageBytes): StorageBytes {
    const result = this.bytes - other.bytes;
    if (result < BigInt(0)) {
      throw new Error('Cannot subtract more bytes than available');
    }

    return new StorageBytes(result);
  }

  isGreaterThan(other: StorageBytes): boolean {
    return this.bytes > other.bytes;
  }

  isLessThan(other: StorageBytes): boolean {
    return this.bytes < other.bytes;
  }

  equals(other: StorageBytes): boolean {
    return this.bytes === other.bytes;
  }

  toString(): string {
    if (this.bytes >= BigInt(1024) * BigInt(1024) * BigInt(1024)) {
      return `${this.toGigabytes().toFixed(2)} GB`;
    } else if (this.bytes >= BigInt(1024) * BigInt(1024)) {
      return `${this.toMegabytes().toFixed(2)} MB`;
    } else if (this.bytes >= BigInt(1024)) {
      return `${(Number(this.bytes) / 1024).toFixed(2)} KB`;
    } else {
      return `${Number(this.bytes)} bytes`;
    }
  }
}
