import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

export class Subdomain {
  private readonly _value: string;

  constructor(value: string) {
    this.validate(value);
    this._value = value.toLowerCase().trim();
  }

  private validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new InvalidValueObjectException('Subdomain cannot be empty');
    }

    const trimmed = value.trim();

    if (trimmed.length < 2) {
      throw new InvalidValueObjectException('Subdomain must be at least 2 characters long');
    }

    if (trimmed.length > 63) {
      throw new InvalidValueObjectException('Subdomain cannot exceed 63 characters');
    }

    // RFC 1123 subdomain validation
    const subdomainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
    if (!subdomainRegex.test(trimmed.toLowerCase())) {
      throw new InvalidValueObjectException(
        'Subdomain must contain only lowercase letters, numbers, and hyphens. Cannot start or end with hyphen',
      );
    }

    // Reserved subdomains
    const reservedSubdomains = [
      'www',
      'api',
      'admin',
      'app',
      'mail',
      'ftp',
      'localhost',
      'staging',
      'dev',
      'test',
      'demo',
      'support',
      'help',
      'docs',
      'status',
      'blog',
      'cdn',
      'assets',
      'static',
      'media',
      'images',
      'uploads',
      'files',
      'downloads',
      'secure',
      'auth',
      'login',
      'register',
      'dashboard',
      'panel',
      'control',
      'manage',
      'system',
      'internal',
      'private',
      'public',
      'root',
      'home',
    ];

    if (reservedSubdomains.includes(trimmed.toLowerCase())) {
      throw new InvalidValueObjectException(
        `Subdomain '${trimmed}' is reserved and cannot be used`,
      );
    }
  }

  getValue(): string {
    return this._value;
  }

  equals(other: Subdomain): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
