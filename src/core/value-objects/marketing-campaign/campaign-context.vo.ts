import { ValueObject } from '@core/value-objects/value-object';
import { InvalidCampaignContextException } from '@core/exceptions/marketing-campaign.exceptions';

export class CampaignContext extends ValueObject<string> {
  private static readonly MAX_LENGTH = 2000;

  protected validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new InvalidCampaignContextException('Campaign context cannot be empty');
    }

    if (value.length > CampaignContext.MAX_LENGTH) {
      throw new InvalidCampaignContextException(
        `Campaign context cannot exceed ${CampaignContext.MAX_LENGTH} characters`,
      );
    }
  }

  public static create(value: string): CampaignContext {
    return new CampaignContext(value.trim());
  }

  public static fromString(value: string): CampaignContext {
    return new CampaignContext(value);
  }
}
