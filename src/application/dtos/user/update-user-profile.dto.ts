import { IsString, IsOptional, IsBoolean, IsDateString, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
// import { CountryExists, StateExists } from '@shared/validators/country-state.validator';
// import { AgentPhoneUniqueForCompany } from '@shared/validators/agent-phone.validator';
import {
  PhoneRequiresCountryCode,
  PhoneCountryCodeRequiresPhone,
  CountryRequiresState,
} from '@shared/validators/register-conditional.validator';

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
  // @CountryExists() // Validation moved to UserService
  country?: string;

  @ApiPropertyOptional({
    description: 'State name (required when country is provided)',
    example: 'Puebla',
  })
  @IsString()
  @IsOptional()
  // @StateExists() // Validation moved to UserService
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

export class UpdateUserProfileDto {
  @ApiPropertyOptional({
    description: 'User first name',
    example: 'John',
  })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({
    description: 'User last name',
    example: 'Doe',
  })
  @IsString()
  @IsOptional()
  lastName?: string;

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
  // @AgentPhoneUniqueForCompany() // Validation moved to UserService
  agentPhone?: string;

  @ApiPropertyOptional({
    description: 'Country code for agent phone number (e.g., 52 for Mexico)',
    example: '52',
    default: '52',
  })
  @IsString()
  @IsOptional()
  agentPhoneCountryCode?: string;

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
