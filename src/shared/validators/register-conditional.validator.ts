import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
// Interface for objects that have profile and address properties
interface IHasProfileAndAddress {
  profile?: {
    phone?: string;
    phoneCountryCode?: string;
  };
  address?: {
    country?: string;
    state?: string;
  };
}

/**
 * Validator to check if phoneCountryCode is provided when phone is provided
 */
@ValidatorConstraint({ name: 'phoneRequiresCountryCode', async: false })
export class PhoneRequiresCountryCodeConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments) {
    const dto = args.object as IHasProfileAndAddress;

    // If phone is provided in profile, phoneCountryCode must be provided
    if (dto.profile?.phone && dto.profile.phone.trim() !== '') {
      return dto.profile?.phoneCountryCode && dto.profile.phoneCountryCode.trim() !== '';
    }

    return true; // If no phone, validation passes
  }

  defaultMessage(_args: ValidationArguments) {
    return 'Phone country code is required when phone number is provided';
  }
}

/**
 * Validator to check if phoneCountryCode is provided when phone is provided
 */
@ValidatorConstraint({ name: 'phoneCountryCodeRequiresPhone', async: false })
export class PhoneCountryCodeRequiresPhoneConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments) {
    const dto = args.object as IHasProfileAndAddress;

    // If phoneCountryCode is provided in profile, phone must be provided
    if (dto.profile?.phoneCountryCode && dto.profile.phoneCountryCode.trim() !== '') {
      return dto.profile?.phone && dto.profile.phone.trim() !== '';
    }

    return true; // If no phoneCountryCode, validation passes
  }

  defaultMessage(_args: ValidationArguments) {
    return 'Phone number is required when phone country code is provided';
  }
}

/**
 * Validator to check if state is provided when country is provided
 */
@ValidatorConstraint({ name: 'countryRequiresState', async: false })
export class CountryRequiresStateConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments) {
    const dto = args.object as IHasProfileAndAddress;

    // If country is provided, state must also be provided
    if (dto.address?.country && dto.address.country.trim() !== '') {
      return dto.address?.state && dto.address.state.trim() !== '';
    }

    return true; // If no country, validation passes
  }

  defaultMessage(_args: ValidationArguments) {
    return 'State is required when country is provided';
  }
}

/**
 * Decorator for phone requires country code validation
 */
export function PhoneRequiresCountryCode(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: PhoneRequiresCountryCodeConstraint,
    });
  };
}

/**
 * Decorator for phone country code requires phone validation
 */
export function PhoneCountryCodeRequiresPhone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: PhoneCountryCodeRequiresPhoneConstraint,
    });
  };
}

/**
 * Decorator for country requires state validation
 */
export function CountryRequiresState(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: CountryRequiresStateConstraint,
    });
  };
}
