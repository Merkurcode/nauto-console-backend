import { DomainException } from '@core/exceptions/domain-exceptions';
import { IndustryOperationChannelEnum } from '@shared/constants/enums';
import { HttpStatus } from '@nestjs/common';

export class InvalidIndustryOperationChannelException extends DomainException {
  constructor(value: string) {
    const validValues = Object.values(IndustryOperationChannelEnum).join(', ');
    super(
      `Invalid industry operation channel "${value}". Valid values are: ${validValues}`,
      HttpStatus.BAD_REQUEST,
    );
  }
}
