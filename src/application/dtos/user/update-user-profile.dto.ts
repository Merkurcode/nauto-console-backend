import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CountryExists, StateExists } from '@shared/validators/country-state.validator';
import { AgentPhoneUniqueForCompany } from '@shared/validators/agent-phone.validator';

export class ProfileDto {
  @ApiPropertyOptional({
    description: 'User phone number',
    example: '2211778811',
  })
  @IsString()
  @IsOptional()
  phone?: string;

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
    description: 'Country name',
    example: 'México',
  })
  @IsString()
  @IsOptional()
  @CountryExists()
  country?: string;

  @ApiPropertyOptional({
    description: 'State name',
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
  @AgentPhoneUniqueForCompany()
  agentPhone?: string;

  @ApiPropertyOptional({
    description: 'User profile information',
    type: ProfileDto,
  })
  @ValidateNested()
  @Type(() => ProfileDto)
  @IsOptional()
  profile?: ProfileDto;

  @ApiPropertyOptional({
    description: 'User address information',
    type: AddressDto,
  })
  @ValidateNested()
  @Type(() => AddressDto)
  @IsOptional()
  address?: AddressDto;
}
