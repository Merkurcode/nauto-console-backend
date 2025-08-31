import { DomainException } from './domain-exceptions';

export abstract class MarketingCampaignDomainException extends DomainException {}

export class MarketingCampaignNotFoundException extends MarketingCampaignDomainException {
  constructor(id: string) {
    super(`Marketing campaign with id ${id} not found`, 'MARKETING_CAMPAIGN_NOT_FOUND', { id });
  }
}

export class MarketingCampaignUTMNameAlreadyExistsException extends MarketingCampaignDomainException {
  constructor(utmName: string) {
    super(
      `Marketing campaign with UTM name '${utmName}' already exists`,
      'MARKETING_CAMPAIGN_UTM_NAME_ALREADY_EXISTS',
      { utmName },
    );
  }
}

export class InvalidUTMNameException extends MarketingCampaignDomainException {
  constructor(message: string) {
    super(message, 'INVALID_UTM_NAME');
  }
}

export class InvalidReferenceNameException extends MarketingCampaignDomainException {
  constructor(message: string) {
    super(message, 'INVALID_REFERENCE_NAME');
  }
}

export class InvalidCampaignContextException extends MarketingCampaignDomainException {
  constructor(message: string) {
    super(message, 'INVALID_CAMPAIGN_CONTEXT');
  }
}

export class InvalidMetaIdException extends MarketingCampaignDomainException {
  constructor(message: string) {
    super(message, 'INVALID_META_ID');
  }
}

export class InvalidCampaignDateRangeException extends MarketingCampaignDomainException {
  constructor(startDate: Date, endDate: Date) {
    super(
      `Invalid date range: start date (${startDate.toISOString()}) must be before end date (${endDate.toISOString()})`,
      'INVALID_CAMPAIGN_DATE_RANGE',
      { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    );
  }
}

export class CampaignAlreadyEnabledException extends MarketingCampaignDomainException {
  constructor(id: string) {
    super(`Marketing campaign with id ${id} is already enabled`, 'CAMPAIGN_ALREADY_ENABLED', {
      id,
    });
  }
}

export class CampaignAlreadyDisabledException extends MarketingCampaignDomainException {
  constructor(id: string) {
    super(`Marketing campaign with id ${id} is already disabled`, 'CAMPAIGN_ALREADY_DISABLED', {
      id,
    });
  }
}

export class UnauthorizedCampaignAccessException extends MarketingCampaignDomainException {
  constructor(campaignId: string, companyId: string) {
    super(
      `Unauthorized access to marketing campaign ${campaignId} from company ${companyId}`,
      'UNAUTHORIZED_CAMPAIGN_ACCESS',
      { campaignId, companyId },
    );
  }
}
