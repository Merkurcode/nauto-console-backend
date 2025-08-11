export class MaxSimultaneousFiles {
  private constructor(private readonly value: number) {}

  static create(value: number, maxAllowed: number = 50): MaxSimultaneousFiles {
    if (value < 1) {
      throw new Error('Maximum simultaneous files must be at least 1');
    }

    if (value > maxAllowed) {
      throw new Error(`Maximum simultaneous files cannot exceed ${maxAllowed} (configured limit)`);
    }

    return new MaxSimultaneousFiles(value);
  }

  getValue(): number {
    return this.value;
  }

  canUploadFiles(fileCount: number): boolean {
    return fileCount <= this.value;
  }

  equals(other: MaxSimultaneousFiles): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value.toString();
  }
}
