import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

export class Host {
  private readonly _value: string;

  constructor(value: string) {
    this.validate(value);
    this._value = value.toLowerCase().trim();
  }

  private validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new InvalidValueObjectException('Host cannot be empty');
    }

    const trimmed = value.trim();

    if (trimmed.length < 3) {
      throw new InvalidValueObjectException('Host must be at least 3 characters long');
    }

    if (trimmed.length > 255) {
      throw new InvalidValueObjectException('Host cannot exceed 255 characters');
    }

    // Basic hostname validation (allows IP addresses and domain names)
    const hostRegex =
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$|^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^localhost$/i;
    if (!hostRegex.test(trimmed)) {
      throw new InvalidValueObjectException(
        'Host must be a valid hostname, IP address, or localhost',
      );
    }

    // Reserved hosts
    const reservedHosts = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      'example.com',
      'test.com',
      'invalid',
      'local',
    ];

    if (reservedHosts.includes(trimmed.toLowerCase())) {
      throw new InvalidValueObjectException(`Host '${trimmed}' is reserved and cannot be used`);
    }
  }

  getValue(): string {
    return this._value;
  }

  equals(other: Host): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
