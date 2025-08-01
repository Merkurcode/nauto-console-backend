import { InvalidIndustrySectorException } from '@core/exceptions/invalid-industry-sector.exception';
import { IndustrySectorEnum } from '@shared/constants/enums';

export class IndustrySector {
  private readonly _value: IndustrySectorEnum;

  private constructor(value: IndustrySectorEnum) {
    this._value = value;
  }

  get value(): IndustrySectorEnum {
    return this._value;
  }

  public static create(value: string): IndustrySector {
    if (!IndustrySector.isValid(value)) {
      throw new InvalidIndustrySectorException(value);
    }

    return new IndustrySector(value as IndustrySectorEnum);
  }

  public static isValid(value: string): boolean {
    return Object.values(IndustrySectorEnum).includes(value as IndustrySectorEnum);
  }

  public static getValidValues(): string[] {
    return Object.values(IndustrySectorEnum);
  }

  public toString(): string {
    return this._value;
  }

  public equals(other: IndustrySector): boolean {
    return this._value === other._value;
  }
}
