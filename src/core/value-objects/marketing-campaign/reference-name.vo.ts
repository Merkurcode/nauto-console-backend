import { ValueObject } from '@core/value-objects/value-object';
import { InvalidReferenceNameException } from '@core/exceptions/marketing-campaign.exceptions';

export class ReferenceName extends ValueObject<string> {
  private static readonly MAX_LENGTH = 255;

  protected validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new InvalidReferenceNameException('Reference name cannot be empty');
    }

    if (value.length > ReferenceName.MAX_LENGTH) {
      throw new InvalidReferenceNameException(
        `Reference name cannot exceed ${ReferenceName.MAX_LENGTH} characters`,
      );
    }
  }

  public static create(value: string): ReferenceName {
    return new ReferenceName(value.trim());
  }

  public static fromString(value: string): ReferenceName {
    return new ReferenceName(value);
  }
}
