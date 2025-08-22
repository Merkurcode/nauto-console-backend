import { ValueObject } from './base.vo';
import { InvalidObjectKeyException } from '@core/exceptions/storage-domain.exceptions';

export class ObjectKey extends ValueObject<string> {
  constructor(value: string) {
    super(value);
    this.validate();
  }

  protected validate(): void {
    if (typeof this.value !== 'string' || this.value.length === 0) {
      throw new InvalidObjectKeyException('Object key cannot be empty');
    }

    // Límite real en S3/MinIO: 1024 bytes UTF-8
    if (Buffer.byteLength(this.value, 'utf8') > 1024) {
      throw new InvalidObjectKeyException('Object key cannot exceed 1024 bytes');
    }

    // No empezar/terminar con slash y sin dobles slashes
    if (this.value.startsWith('/') || this.value.endsWith('/')) {
      throw new InvalidObjectKeyException('Object key cannot start or end with slash');
    }
    if (this.value.includes('//')) {
      throw new InvalidObjectKeyException('Object key cannot contain double slashes');
    }

    // Caracteres peligrosos / control chars (incluye backslash)
    const invalidChars = /[<>:"|?*\\\x00-\x1f\x7f]/;
    if (invalidChars.test(this.value)) {
      throw new InvalidObjectKeyException('Object key contains invalid characters');
    }

    // Evitar traversal con ".." por segmentos
    if (/(^|\/)\.\.(\/|$)/.test(this.value)) {
      throw new InvalidObjectKeyException('Object key cannot contain parent directory segments');
    }
  }

  /**
   * Une path + filename en un key válido
   */
  public static join(path: string, filename: string): ObjectKey {
    if (typeof filename !== 'string' || filename.length === 0) {
      throw new InvalidObjectKeyException('Filename cannot be empty');
    }

    // Validar filename (sin slashes, backslash ni control chars, ni '..')
    if (/[\/\\]/.test(filename)) {
      throw new InvalidObjectKeyException('Filename cannot contain slashes');
    }
    if (/[\x00-\x1f\x7f]/.test(filename)) {
      throw new InvalidObjectKeyException('Filename contains control characters');
    }
    if (filename === '.' || filename === '..') {
      throw new InvalidObjectKeyException('Filename cannot be "." or ".."');
    }
    if (/[<>:"|?*]/.test(filename)) {
      throw new InvalidObjectKeyException('Filename contains invalid characters');
    }

    // Normaliza path (quita slashes al inicio/fin). Si trae backslash o '..', inválido.
    const cleanPath = (path || '').replace(/^\/+|\/+$/g, '');
    if (/[\\]/.test(cleanPath)) {
      throw new InvalidObjectKeyException('Path cannot contain backslashes');
    }
    if (/(^|\/)\.\.(\/|$)/.test(cleanPath)) {
      throw new InvalidObjectKeyException('Path cannot contain parent directory segments');
    }
    if (cleanPath.includes('//')) {
      throw new InvalidObjectKeyException('Path cannot contain double slashes');
    }

    const objectKey = cleanPath ? `${cleanPath}/${filename}` : filename;

    return new ObjectKey(objectKey);
  }

  public static create(value: string): ObjectKey {
    return new ObjectKey(value);
  }

  public getFilename(): string {
    const parts = this.value.split('/');

    return parts[parts.length - 1];
  }

  public getPath(): string {
    const parts = this.value.split('/');

    return parts.length === 1 ? '' : parts.slice(0, -1).join('/');
  }

  public withFilename(newFilename: string): ObjectKey {
    return ObjectKey.join(this.getPath(), newFilename);
  }

  public withPath(newPath: string): ObjectKey {
    return ObjectKey.join(newPath, this.getFilename());
  }

  public toString(): string {
    return this.value;
  }
}
