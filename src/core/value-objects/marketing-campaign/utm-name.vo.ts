import { ValueObject } from '@core/value-objects/value-object';
import { InvalidUTMNameException } from '@core/exceptions/marketing-campaign.exceptions';
import * as crypto from 'crypto';

export class UTMName extends ValueObject<string> {
  private static readonly MAX_LENGTH = 255;

  protected validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new InvalidUTMNameException('UTM name cannot be empty');
    }

    if (value.length > UTMName.MAX_LENGTH) {
      throw new InvalidUTMNameException(`UTM name cannot exceed ${UTMName.MAX_LENGTH} characters`);
    }
  }

  public static create(referenceName: string): UTMName {
    const normalizedName = UTMName.generateFromReferenceName(referenceName);

    return new UTMName(normalizedName);
  }

  public static fromString(value: string): UTMName {
    return new UTMName(value);
  }

  private static generateFromReferenceName(referenceName: string): string {
    // Step 1: Replace tabs with single space
    let normalized = referenceName.replace(/\t/g, ' ');

    // Step 2: Replace multiple spaces with single space
    normalized = normalized.replace(/\s+/g, ' ');

    // Step 3: Trim whitespace
    normalized = normalized.trim();

    // Step 4: Convert to lowercase
    normalized = normalized.toLowerCase();

    // Step 5: Remove accents and special characters (normalize to basic letters)
    normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Step 6: Replace spaces with underscores
    normalized = normalized.replace(/\s/g, '_');

    if (normalized.length === 0) {
      throw new InvalidUTMNameException('Reference name must contain at least one valid character');
    }

    // Generate MD5 hash from the cleaned string
    const hash = crypto.createHash('md5').update(normalized).digest('hex');

    return hash.toLowerCase();
  }
}
