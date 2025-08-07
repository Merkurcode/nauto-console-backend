import { DomainException } from '@core/exceptions/domain-exceptions';
import { IndustryOperationChannelEnum } from '@shared/constants/enums';

export class InvalidIndustryOperationChannelException extends DomainException {
  constructor(value: string) {
    const validValues = Object.values(IndustryOperationChannelEnum).join(', ');
    super(
      `Invalid industry operation channel "${value}". Valid values are: ${validValues}`,
      'INVALID_INDUSTRY_OPERATION_CHANNEL',
      { value, validValues },
    );
  }
}
