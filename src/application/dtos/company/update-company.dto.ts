import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, Length, ValidateNested, IsEnum, IsUUID, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';
import { IndustrySectorEnum, IndustryOperationChannelEnum } from '@shared/constants/enums';

export class UpdateAddressDto {
  @ApiProperty({
    example: 'United States',
    description: 'Country name',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Length(1, 50)
  country?: string;

  @ApiProperty({
    example: 'California',
    description: 'State name',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Length(1, 50)
  state?: string;

  @ApiProperty({
    example: 'Los Angeles',
    description: 'City name',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Length(1, 50)
  city?: string;

  @ApiProperty({
    example: 'Main Street',
    description: 'Street name',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  street?: string;

  @ApiProperty({
    example: '123',
    description: 'Exterior number',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Length(1, 10)
  exteriorNumber?: string;

  @ApiProperty({
    example: 'A',
    description: 'Interior number',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Length(1, 10)
  interiorNumber?: string;

  @ApiProperty({
    example: '90210',
    description: 'Postal code',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Length(1, 10)
  postalCode?: string;
}

export class UpdateCompanyDto {
  @ApiProperty({
    example: 'Acme Corporation',
    description: 'Company name',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Length(2, 100)
  name?: string;

  @ApiProperty({
    example: 'A leading technology company focused on innovative solutions',
    description: 'Company description',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Length(10, 500)
  description?: string;

  @ApiProperty({
    example: 'Technology',
    description: 'Business sector',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  businessSector?: string;

  @ApiProperty({
    example: 'Software Development',
    description: 'Business unit',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  businessUnit?: string;

  @ApiProperty({
    example: 'acme-corp.com',
    description: 'Company host domain',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Length(3, 255)
  host?: string;

  @ApiProperty({
    type: UpdateAddressDto,
    description: 'Company address',
    required: false,
  })
  @ValidateNested()
  @Type(() => UpdateAddressDto)
  @IsOptional()
  address?: UpdateAddressDto;

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
  parentCompanyId?: string;

  @ApiProperty({
    example: 'America/Mexico_City',
    description: 'Company timezone',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  timezone?: string;

  @ApiProperty({
    example: 'MXN',
    description: 'Company currency',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiProperty({
    example: 'es-MX',
    description: 'Company language',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(2, 10)
  language?: string;

  @ApiProperty({
    example: 'https://example.com/logo.png',
    description: 'Company logo URL',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiProperty({
    example: 'https://example.com',
    description: 'Company website URL',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @ApiProperty({
    example: 'https://example.com/privacy',
    description: 'Company privacy policy URL',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  privacyPolicyUrl?: string;
}
