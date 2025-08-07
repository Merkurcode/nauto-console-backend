import { DomainException } from '@core/exceptions/domain-exceptions';
import { IndustrySectorEnum } from '@shared/constants/enums';

export class InvalidIndustrySectorException extends DomainException {
  constructor(value: string) {
    const validValues = Object.values(IndustrySectorEnum).join(', ');
    super(
      `Invalid industry sector "${value}". Valid values are: ${validValues}`,
      'INVALID_INDUSTRY_SECTOR',
      { value, validValues },
    );
  }
}
