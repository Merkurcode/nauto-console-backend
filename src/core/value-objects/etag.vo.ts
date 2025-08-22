import { ValueObject } from './base.vo';
import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

export class ETag extends ValueObject<string> {
  constructor(value: string) {
    super(value);
    this.validate();
  }

  protected validate(): void {
    if (!this.value || typeof this.value !== 'string') {
      throw new InvalidValueObjectException('ETag cannot be empty', 'ETag');
    }

    if (this.value.length < 1 || this.value.length > 1024) {
      throw new InvalidValueObjectException('ETag must be between 1 and 1024 characters', 'ETag');
    }

    // ETags should typically be quoted hex strings or follow AWS format
    // Examples: "d41d8cd98f00b204e9800998ecf8427e", "9bb58f26192e4ba00f01e2e7b136bbd8-5"
    const validFormat = /^"?[a-fA-F0-9-]+"?$/;
    if (!validFormat.test(this.value)) {
      throw new InvalidValueObjectException('ETag must be a valid hexadecimal string', 'ETag');
    }
  }

  public static create(value: string): ETag {
    return new ETag(value);
  }

  /**
   * Gets the ETag value without quotes if present
   */
  public getUnquoted(): string {
    return this.value.replace(/^"|"$/g, '');
  }

  /**
   * Gets the ETag value with quotes if not present
   */
  public getQuoted(): string {
    return this.value.startsWith('"') ? this.value : `"${this.value}"`;
  }

  public toString(): string {
    return this.value;
  }
}
