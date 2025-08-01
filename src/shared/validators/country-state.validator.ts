import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { Injectable, Inject } from '@nestjs/common';
import { ICountryRepository } from '@core/repositories/country.repository.interface';
import { IStateRepository } from '@core/repositories/state.repository.interface';
import { COUNTRY_REPOSITORY, STATE_REPOSITORY } from '@shared/constants/tokens';

@ValidatorConstraint({ name: 'CountryExists', async: true })
@Injectable()
export class CountryExistsConstraint implements ValidatorConstraintInterface {
  constructor(
    @Inject(COUNTRY_REPOSITORY)
    private readonly countryRepository: ICountryRepository,
  ) {}

  async validate(countryName: string, _args: ValidationArguments): Promise<boolean> {
    if (!countryName) {
      return true; // Let @IsOptional handle empty values
    }

    const country = await this.countryRepository.findByName(countryName);

    return !!country;
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'Country "$value" does not exist';
  }
}

@ValidatorConstraint({ name: 'StateExists', async: true })
@Injectable()
export class StateExistsConstraint implements ValidatorConstraintInterface {
  constructor(
    @Inject(STATE_REPOSITORY)
    private readonly stateRepository: IStateRepository,
    @Inject(COUNTRY_REPOSITORY)
    private readonly countryRepository: ICountryRepository,
  ) {}

  async validate(stateName: string, args: ValidationArguments): Promise<boolean> {
    if (!stateName) {
      return true; // Let @IsOptional handle empty values
    }

    // Get the country from the same object being validated
    const addressDto = args.object as Record<string, unknown>;
    const countryName = addressDto.country as string;

    if (!countryName) {
      return false; // State requires a country
    }

    // First verify country exists
    const country = await this.countryRepository.findByName(countryName);
    if (!country) {
      return false; // Can't validate state if country doesn't exist
    }

    // Then verify state exists within that country
    const state = await this.stateRepository.findByNameAndCountry(stateName, country.id.getValue());

    return !!state;
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'State "$value" does not exist in the specified country';
  }
}

export function CountryExists(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: CountryExistsConstraint,
    });
  };
}

export function StateExists(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: StateExistsConstraint,
    });
  };
}
