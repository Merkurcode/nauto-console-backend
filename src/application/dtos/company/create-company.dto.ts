import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  Length,
  ValidateNested,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IndustrySectorEnum, IndustryOperationChannelEnum } from '@shared/constants/enums';

export class CreateAddressDto {
  @ApiProperty({
    example: 'United States',
    description: 'Country name',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  country: string;

  @ApiProperty({
    example: 'California',
    description: 'State name',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  state: string;

  @ApiProperty({
    example: 'Los Angeles',
    description: 'City name',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  city: string;

  @ApiProperty({
    example: 'Main Street',
    description: 'Street name',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  street: string;

  @ApiProperty({
    example: '123',
    description: 'Exterior number',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 10)
  exteriorNumber: string;

  @ApiProperty({
    example: 'A',
    description: 'Interior number',
    required: false,
  })
  @IsString()
  @Length(1, 10)
  interiorNumber?: string;

  @ApiProperty({
    example: '90210',
    description: 'Postal code',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 10)
  postalCode: string;
}

export class CreateCompanyDto {
  @ApiProperty({
    example: 'Acme Corporation',
    description: 'Company name',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name: string;

  @ApiProperty({
    example: 'A leading technology company focused on innovative solutions',
    description: 'Company description',
  })
  @IsString()
  @IsNotEmpty()
  @Length(10, 500)
  description: string;

  @ApiProperty({
    example: 'Technology',
    description: 'Business sector',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  businessSector: string;

  @ApiProperty({
    example: 'Software Development',
    description: 'Business unit',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  businessUnit: string;

  @ApiProperty({
    example: 'acme-corp.com',
    description: 'Company host domain',
  })
  @IsString()
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
  parentCompanyId?: string;
}
