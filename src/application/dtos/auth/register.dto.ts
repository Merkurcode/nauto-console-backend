import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  Matches,
  IsOptional,
  IsBoolean,
  ValidateNested,
  IsArray,
  IsDate,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { NormalizeEmail } from '@shared/decorators/normalize-email.decorator';
import {
  TrimString,
  TrimAndValidateLength,
} from '@shared/decorators/trim-and-validate-length.decorator';
// import { CountryExists, StateExists } from '@shared/validators/country-state.validator';
// import { AgentPhoneUniqueForCompany } from '@shared/validators/agent-phone.validator';
import {
  PhoneRequiresCountryCode,
  PhoneCountryCodeRequiresPhone,
  CountryRequiresState,
} from '@shared/validators/register-conditional.validator';
import { RolesEnum } from '@shared/constants/enums';

export class ProfileDto {
  @ApiPropertyOptional({
    description: 'User phone number',
    example: '2211778811',
  })
  @IsOptional()
  @IsString()
  @TrimString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Country code for phone number (e.g., 52 for Mexico)',
    example: '52',
    default: '52',
  })
  @IsOptional()
  @IsString()
  @TrimString()
  phoneCountryCode?: string;

  @ApiPropertyOptional({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg',
  })
  @IsOptional()
  @IsString()
  @TrimString()
  avatarUrl?: string;

  @ApiPropertyOptional({
    description: 'User bio',
    example: 'Software developer with 5 years of experience',
  })
  @IsOptional()
  @IsString()
  @TrimString()
  bio?: string;

  @ApiPropertyOptional({
    description: 'User birth date',
    example: '1990-01-01',
  })
  @IsOptional()
  @IsString()
  @TrimString()
  birthDate?: string;
}

export class AddressDto {
  @ApiPropertyOptional({
    description: 'Country name (requires state when provided)',
    example: 'México',
  })
  @IsOptional()
  @IsString()
  @TrimString()
  // @CountryExists() // Validation moved to UserService
  country?: string;

  @ApiPropertyOptional({
    description: 'State name (required when country is provided)',
    example: 'Puebla',
  })
  @IsOptional()
  @IsString()
  @TrimString()
  // @StateExists() // Validation moved to UserService
  state?: string;

  @ApiPropertyOptional({
    description: 'City name',
    example: 'Puebla',
  })
  @IsOptional()
  @IsString()
  @TrimString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Street name',
    example: 'Calle 5 de Mayo',
  })
  @IsOptional()
  @IsString()
  @TrimString()
  street?: string;

  @ApiPropertyOptional({
    description: 'Exterior number',
    example: '123',
  })
  @IsOptional()
  @IsString()
  @TrimString()
  exteriorNumber?: string;

  @ApiPropertyOptional({
    description: 'Interior number',
    example: 'A',
  })
  @IsOptional()
  @IsString()
  @TrimString()
  interiorNumber?: string;

  @ApiPropertyOptional({
    description: 'Postal code',
    example: '72000',
  })
  @IsOptional()
  @IsString()
  @TrimString()
  postalCode?: string;
}

export class RegisterDto {
  @ApiProperty({
    description: 'User email address (case-insensitive, automatically trimmed)',
    example: 'user@example.com',
  })
  @NormalizeEmail()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description:
      'User password (optional - if not provided, a random password will be generated and sent by email)',
    example: 'Password123!',
    minLength: 8,
    required: false,
  })
  @IsString()
  @TrimAndValidateLength({ min: 8 })
  @IsOptional()
  @MinLength(8)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_])[A-Za-z\d!@#$%^&*(),.?":{}|<>_]{8,}$/,
    {
      message:
        'Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character',
    },
  )
  password?: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  @TrimString()
  firstName!: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  @TrimString()
  lastName!: string;

  @ApiPropertyOptional({
    description: 'User second last name',
    example: 'Smith',
  })
  @IsOptional()
  @IsString()
  @TrimString()
  secondLastName?: string;

  @ApiPropertyOptional({
    description: 'Whether user is active',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Whether email is verified',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  emailVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Date until user is banned',
    example: null,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  bannedUntil?: Date;

  @ApiPropertyOptional({
    description: 'Reason for ban',
    example: null,
  })
  @IsOptional()
  @IsString()
  @TrimString()
  banReason?: string;

  @ApiPropertyOptional({
    description: 'Agent phone number',
    example: '1234567890',
  })
  @IsOptional()
  @IsString()
  @TrimString()
  // @AgentPhoneUniqueForCompany() // TODO: Fix dependency injection for validator
  agentPhone?: string;

  @ApiPropertyOptional({
    description: 'Country code for agent phone number (e.g., 52 for Mexico)',
    example: '52',
    default: '52',
  })
  @IsOptional()
  @IsString()
  @TrimString()
  agentPhoneCountryCode?: string;

  @ApiProperty({
    description: 'Company name',
    example: 'Default Company',
  })
  @IsString()
  @IsNotEmpty()
  @TrimString()
  company!: string;

  @ApiPropertyOptional({
    description: 'User roles',
    example: [RolesEnum.GUEST],
    enum: RolesEnum,
    isArray: true,
    enumName: 'RolesEnum',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @TrimString()
  roles?: string[];

  @ApiPropertyOptional({
    description: 'User profile information',
    type: ProfileDto,
  })
  @ValidateNested()
  @Type(() => ProfileDto)
  @IsOptional()
  @PhoneRequiresCountryCode()
  @PhoneCountryCodeRequiresPhone()
  profile?: ProfileDto;

  @ApiPropertyOptional({
    description: 'User address information',
    type: AddressDto,
  })
  @ValidateNested()
  @Type(() => AddressDto)
  @IsOptional()
  @CountryRequiresState()
  address?: AddressDto;
}
