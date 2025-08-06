import { InvalidIndustryOperationChannelException } from '@core/exceptions/invalid-industry-operation-channel.exception';
import { IndustryOperationChannelEnum } from '@shared/constants/enums';

export class IndustryOperationChannel {
  private readonly _value: IndustryOperationChannelEnum;

  private constructor(value: IndustryOperationChannelEnum) {
    this._value = value;
  }

  get value(): IndustryOperationChannelEnum {
    return this._value;
  }

  public static create(value: string): IndustryOperationChannel {
    if (!IndustryOperationChannel.isValid(value)) {
      throw new InvalidIndustryOperationChannelException(value);
    }

    return new IndustryOperationChannel(value as IndustryOperationChannelEnum);
  }

  public static isValid(value: string): boolean {
    return Object.values(IndustryOperationChannelEnum).includes(
      value as IndustryOperationChannelEnum,
    );
  }

  public static getValidValues(): string[] {
    return Object.values(IndustryOperationChannelEnum);
  }

  public toString(): string {
    return this._value;
  }

  public equals(other: IndustryOperationChannel): boolean {
    return this._value === other._value;
  }
}
