import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  Length,
  ValidateNested,
  IsEnum,
  IsOptional,
  IsUUID,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IndustrySectorEnum, IndustryOperationChannelEnum } from '@shared/constants/enums';
import {
  TrimString,
  TrimAndValidateLength,
} from '@shared/decorators/trim-and-validate-length.decorator';

export class CreateAddressDto {
  @ApiProperty({
    example: 'United States',
    description: 'Country name',
  })
  @IsString()
  @TrimAndValidateLength({ min: 1, max: 50 })
  @IsNotEmpty()
  @Length(1, 50)
  country: string;

  @ApiProperty({
    example: 'California',
    description: 'State name',
  })
  @IsString()
  @TrimAndValidateLength({ min: 1, max: 50 })
  @IsNotEmpty()
  @Length(1, 50)
  state: string;

  @ApiProperty({
    example: 'Los Angeles',
    description: 'City name',
  })
  @IsString()
  @TrimAndValidateLength({ min: 1, max: 50 })
  @IsNotEmpty()
  @Length(1, 50)
  city: string;

  @ApiProperty({
    example: 'Main Street',
    description: 'Street name',
  })
  @IsString()
  @TrimAndValidateLength({ min: 1, max: 100 })
  @IsNotEmpty()
  @Length(1, 100)
  street: string;

  @ApiProperty({
    example: '123',
    description: 'Exterior number',
  })
  @IsString()
  @TrimAndValidateLength({ min: 1, max: 10 })
  @IsNotEmpty()
  @Length(1, 10)
  exteriorNumber: string;

  @ApiProperty({
    example: 'A',
    description: 'Interior number',
    required: false,
  })
  @IsString()
  @TrimAndValidateLength({ min: 1, max: 10 })
  @Length(1, 10)
  interiorNumber?: string;

  @ApiProperty({
    example: '90210',
    description: 'Postal code',
  })
  @IsString()
  @TrimAndValidateLength({ min: 1, max: 10 })
  @IsNotEmpty()
  @Length(1, 10)
  postalCode: string;

  @ApiProperty({
    example: 'https://maps.google.com/?q=123+Main+Street,Los+Angeles,CA',
    description: 'Google Maps URL for the address',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  @TrimString()
  googleMapsUrl?: string;
}

export class CreateCompanyDto {
  @ApiProperty({
    example: 'Acme Corporation',
    description: 'Company name',
  })
  @IsString()
  @TrimAndValidateLength({ min: 2, max: 100 })
  @IsNotEmpty()
  @Length(2, 100)
  name: string;

  @ApiProperty({
    example: 'A leading technology company focused on innovative solutions',
    description: 'Company description',
  })
  @IsString()
  @TrimAndValidateLength({ min: 10, max: 500 })
  @IsNotEmpty()
  @Length(10, 500)
  description: string;

  @ApiProperty({
    example: 'acme-corp.com',
    description: 'Company host domain',
  })
  @IsString()
  @TrimAndValidateLength({ min: 3, max: 255 })
  @IsNotEmpty()
  @Length(3, 255)
  host: string;

  @ApiProperty({
    type: CreateAddressDto,
    description: 'Company address',
  })
  @ValidateNested()
  @Type(() => CreateAddressDto)
  address: CreateAddressDto;

  @ApiProperty({
    enum: IndustrySectorEnum,
    example: IndustrySectorEnum.OTHER,
    description: 'Industry sector of the company',
    required: false,
  })
  @IsOptional()
  @IsEnum(IndustrySectorEnum)
  industrySector?: IndustrySectorEnum;

  @ApiProperty({
    enum: IndustryOperationChannelEnum,
    example: IndustryOperationChannelEnum.MIXED,
    description: 'Industry operation channel of the company',
    required: false,
  })
  @IsOptional()
  @IsEnum(IndustryOperationChannelEnum)
  industryOperationChannel?: IndustryOperationChannelEnum;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Parent company ID (for subsidiaries)',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  @TrimString()
  parentCompanyId?: string;

  @ApiProperty({
    example: 'America/Mexico_City',
    description: 'Company timezone',
    required: false,
  })
  @IsOptional()
  @IsString()
  @TrimAndValidateLength({ min: 1, max: 50 })
  @Length(1, 50)
  timezone?: string;

  @ApiProperty({
    example: 'MXN',
    description: 'Company currency',
    required: false,
  })
  @IsOptional()
  @IsString()
  @TrimAndValidateLength({ min: 3, max: 3 })
  @Length(3, 3)
  currency?: string;

  @ApiProperty({
    example: 'es-MX',
    description: 'Company language',
    required: false,
  })
  @IsOptional()
  @IsString()
  @TrimAndValidateLength({ min: 2, max: 10 })
  @Length(2, 10)
  language?: string;

  @ApiProperty({
    example: 'https://example.com/logo.png',
    description: 'Company logo URL',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  @TrimString()
  logoUrl?: string;

  @ApiProperty({
    example: 'https://example.com',
    description: 'Company website URL',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  @TrimString()
  websiteUrl?: string;

  @ApiProperty({
    example: 'https://example.com/privacy',
    description: 'Company privacy policy URL',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  @TrimString()
  privacyPolicyUrl?: string;
}
