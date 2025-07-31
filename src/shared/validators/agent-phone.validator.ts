import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { Injectable, Inject } from '@nestjs/common';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { USER_REPOSITORY, COMPANY_REPOSITORY } from '@shared/constants/tokens';

@ValidatorConstraint({ name: 'AgentPhoneUniqueForCompany', async: true })
@Injectable()
export class AgentPhoneUniqueForCompanyConstraint implements ValidatorConstraintInterface {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
  ) {}

  async validate(agentPhone: string, args: ValidationArguments): Promise<boolean> {
    if (!agentPhone) {
      return true; // Let @IsOptional handle empty values
    }

    // Get the company from the same object being validated
    const registerDto = args.object as Record<string, unknown>;
    const companyName = registerDto.company;

    if (!companyName) {
      return true; // If no company specified, can't check uniqueness
    }

    // Find company by name - compare with the getValue() method since c.name is a CompanyName value object
    const companies = await this.companyRepository.findAll();
    const company = companies.find(c => c.name.getValue() === companyName);
    if (!company) {
      return true; // If company doesn't exist, let other validators handle that
    }

    // Check if agent phone already exists for this company
    const existingUser = await this.userRepository.findByAgentPhoneAndCompany(
      agentPhone,
      company.id.getValue(),
    );

    return !existingUser; // Return false if user exists (validation fails)
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'Agent phone "$value" is already in use for this company';
  }
}

export function AgentPhoneUniqueForCompany(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: AgentPhoneUniqueForCompanyConstraint,
    });
  };
}
