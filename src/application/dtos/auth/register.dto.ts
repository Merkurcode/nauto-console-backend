import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  Matches,
  IsOptional,
  IsBoolean,
  IsDateString,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CountryExists, StateExists } from '@shared/validators/country-state.validator';
import { AgentPhoneUniqueForCompany } from '@shared/validators/agent-phone.validator';
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
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Country code for phone number (e.g., 52 for Mexico)',
    example: '52',
    default: '52',
  })
  @IsString()
  @IsOptional()
  phoneCountryCode?: string;

  @ApiPropertyOptional({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg',
  })
  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @ApiPropertyOptional({
    description: 'User bio',
    example: 'Software developer with 5 years of experience',
  })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiPropertyOptional({
    description: 'User birth date',
    example: '1990-01-01',
  })
  @IsString()
  @IsOptional()
  birthDate?: string;
}

export class AddressDto {
  @ApiPropertyOptional({
    description: 'Country name (requires state when provided)',
    example: 'México',
  })
  @IsString()
  @IsOptional()
  @CountryExists()
  country?: string;

  @ApiPropertyOptional({
    description: 'State name (required when country is provided)',
    example: 'Puebla',
  })
  @IsString()
  @IsOptional()
  @StateExists()
  state?: string;

  @ApiPropertyOptional({
    description: 'City name',
    example: 'Puebla',
  })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({
    description: 'Street name',
    example: 'Calle 5 de Mayo',
  })
  @IsString()
  @IsOptional()
  street?: string;

  @ApiPropertyOptional({
    description: 'Exterior number',
    example: '123',
  })
  @IsString()
  @IsOptional()
  exteriorNumber?: string;

  @ApiPropertyOptional({
    description: 'Interior number',
    example: 'A',
  })
  @IsString()
  @IsOptional()
  interiorNumber?: string;

  @ApiPropertyOptional({
    description: 'Postal code',
    example: '72000',
  })
  @IsString()
  @IsOptional()
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Google Maps URL for the address',
    example: 'https://maps.google.com/?q=Calle+5+de+Mayo+123,Puebla,Puebla,Mexico',
  })
  @IsString()
  @IsOptional()
  googleMapsUrl?: string;
}

export class RegisterDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
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
  firstName!: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiPropertyOptional({
    description: 'User second last name',
    example: 'Smith',
  })
  @IsString()
  @IsOptional()
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
  @IsDateString()
  @IsOptional()
  bannedUntil?: string;

  @ApiPropertyOptional({
    description: 'Reason for ban',
    example: null,
  })
  @IsString()
  @IsOptional()
  banReason?: string;

  @ApiPropertyOptional({
    description: 'Agent phone number',
    example: '1234567890',
  })
  @IsString()
  @IsOptional()
  @AgentPhoneUniqueForCompany()
  agentPhone?: string;

  @ApiPropertyOptional({
    description: 'Country code for agent phone number (e.g., 52 for Mexico)',
    example: '52',
    default: '52',
  })
  @IsString()
  @IsOptional()
  agentPhoneCountryCode?: string;

  @ApiProperty({
    description: 'Company name',
    example: 'Default Company',
  })
  @IsString()
  @IsNotEmpty()
  company!: string;

  @ApiPropertyOptional({
    description: 'User roles',
    example: [RolesEnum.GUEST],
    enum: RolesEnum,
    isArray: true,
    enumName: 'RolesEnum',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
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
