import { ValueObject } from '@core/value-objects/value-object';
import { InvalidMetaIdException } from '@core/exceptions/marketing-campaign.exceptions';

export class MetaId extends ValueObject<string | null> {
  private static readonly MAX_LENGTH = 255;

  protected validate(value: string | null): void {
    if (value === null) {
      return; // null is valid for optional MetaId
    }

    if (value.trim().length === 0) {
      throw new InvalidMetaIdException('Meta ID cannot be an empty string');
    }

    if (value.length > MetaId.MAX_LENGTH) {
      throw new InvalidMetaIdException(`Meta ID cannot exceed ${MetaId.MAX_LENGTH} characters`);
    }
  }

  public static create(value: string | null): MetaId {
    if (value === null) {
      return new MetaId(null);
    }

    return new MetaId(value.trim());
  }

  public static fromString(value: string | null): MetaId {
    return new MetaId(value);
  }

  public static empty(): MetaId {
    return new MetaId(null);
  }
}
