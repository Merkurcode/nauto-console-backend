import { DomainException } from '@core/exceptions/domain-exceptions';
import { IndustrySectorEnum } from '@shared/constants/enums';
import { HttpStatus } from '@nestjs/common';

export class InvalidIndustrySectorException extends DomainException {
  constructor(value: string) {
    const validValues = Object.values(IndustrySectorEnum).join(', ');
    super(
      `Invalid industry sector "${value}". Valid values are: ${validValues}`,
      HttpStatus.BAD_REQUEST,
    );
  }
}
