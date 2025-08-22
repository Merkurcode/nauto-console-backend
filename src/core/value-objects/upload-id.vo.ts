import { ValueObject } from './base.vo';
import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

export class UploadId extends ValueObject<string> {
  constructor(value: string) {
    // Normalizamos eliminando espacios accidentales
    super(typeof value === 'string' ? value.trim() : (value as any));
    this.validate();
  }

  protected validate(): void {
    if (typeof this.value !== 'string' || this.value.length === 0) {
      throw new InvalidValueObjectException('Upload ID cannot be empty', 'UploadId');
    }

    if (this.value.length > 1024) {
      throw new InvalidValueObjectException('Upload ID cannot exceed 1024 characters', 'UploadId');
    }

    // Prohibimos caracteres de control y espacios (S3 usa visibles, p.ej. + / = % ...)
    // \x21-\x7E = ASCII visible sin el espacio
    const visibleAsciiNoSpace = /^[\x21-\x7E]+$/;
    if (!visibleAsciiNoSpace.test(this.value)) {
      throw new InvalidValueObjectException(
        'Upload ID contains invalid whitespace or control characters',
        'UploadId',
      );
    }
  }

  public static create(value: string): UploadId {
    return new UploadId(value);
  }

  public toString(): string {
    return this.value;
  }
}
