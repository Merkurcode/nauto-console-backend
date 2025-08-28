import { IsString, IsOptional, IsBoolean, IsDateString, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TrimString } from '@shared/decorators/trim-and-validate-length.decorator';
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

  @ApiPropertyOptional({
    description: 'Google Maps URL for the address',
    example: 'https://maps.google.com/?q=Calle+5+de+Mayo+123,Puebla,Puebla,Mexico',
  })
  @IsOptional()
  @IsString()
  @TrimString()
  googleMapsUrl?: string;
}

export class UpdateUserProfileDto {
  @ApiPropertyOptional({
    description: 'User first name',
    example: 'John',
  })
  @IsOptional()
  @IsString()
  @TrimString()
  firstName?: string;

  @ApiPropertyOptional({
    description: 'User last name',
    example: 'Doe',
  })
  @IsOptional()
  @IsString()
  @TrimString()
  lastName?: string;

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
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Whether email is verified',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Date until user is banned',
    example: null,
  })
  @IsOptional()
  @IsDateString()
  bannedUntil?: string;

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
  // @AgentPhoneUniqueForCompany() // Validation moved to UserService
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
