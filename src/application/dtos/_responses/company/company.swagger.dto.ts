import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IndustrySectorEnum, IndustryOperationChannelEnum } from '@shared/constants/enums';

export class AddressSwaggerDto {
  @ApiProperty({
    example: 'United States',
    description: 'Country name',
  })
  country: string;

  @ApiProperty({
    example: 'California',
    description: 'State name',
  })
  state: string;

  @ApiProperty({
    example: 'Los Angeles',
    description: 'City name',
  })
  city: string;

  @ApiProperty({
    example: 'Main Street',
    description: 'Street name',
  })
  street: string;

  @ApiProperty({
    example: '123',
    description: 'Exterior number',
  })
  exteriorNumber: string;

  @ApiPropertyOptional({
    example: 'A',
    description: 'Interior number',
  })
  interiorNumber?: string;

  @ApiProperty({
    example: '90210',
    description: 'Postal code',
  })
  postalCode: string;

  @ApiProperty({
    example: 'Main Street 123 A, Los Angeles, California, United States 90210',
    description: 'Full formatted address',
  })
  fullAddress: string;
}

export class AssistantFeatureSwaggerDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Feature unique identifier',
  })
  id: string;

  @ApiProperty({
    example: 'lead_qualification',
    description: 'Feature key name',
  })
  keyName: string;

  @ApiProperty({
    example: { en: 'Lead Qualification', es: 'Calificación de Leads' },
    description: 'Feature title in different languages',
  })
  title: Record<string, string>;

  @ApiProperty({
    example: { en: 'Qualify leads automatically', es: 'Califica leads automáticamente' },
    description: 'Feature description in different languages',
  })
  description: Record<string, string>;

  @ApiProperty({
    example: true,
    description: 'Whether the feature is enabled for this company',
  })
  enabled: boolean;
}

export class AssistantSwaggerDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Assistant unique identifier',
  })
  id: string;

  @ApiProperty({
    example: 'Lily',
    description: 'Assistant name',
  })
  name: string;

  @ApiProperty({
    example: 'BRAND_EXPERT',
    description: 'Assistant area of expertise',
  })
  area: string;

  @ApiProperty({
    example: { en: 'Brand expertise assistant', es: 'Asistente experto en marca' },
    description: 'Assistant description in different languages',
  })
  description: Record<string, string>;

  @ApiProperty({
    example: true,
    description: 'Whether the assistant is enabled for this company',
  })
  enabled: boolean;

  @ApiProperty({
    type: [AssistantFeatureSwaggerDto],
    description: 'Features available for this assistant',
  })
  features: AssistantFeatureSwaggerDto[];
}

export class CompanySwaggerDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Company unique identifier (also serves as Tenant ID for multi-tenant operations)',
  })
  id: string;

  @ApiProperty({
    example: 'Acme Corporation',
    description: 'Company name',
  })
  name: string;

  @ApiProperty({
    example: 'A leading technology company focused on innovative solutions',
    description: 'Company description',
  })
  description: string;

  @ApiProperty({
    example: 'acme-corp.com',
    description: 'Company host domain',
  })
  host: string;

  @ApiProperty({
    type: AddressSwaggerDto,
    description: 'Company address',
  })
  address: AddressSwaggerDto;

  @ApiProperty({
    example: true,
    description: 'Whether the company is active',
  })
  isActive: boolean;

  @ApiProperty({
    example: 'America/Mexico_City',
    description: 'Company timezone',
  })
  timezone: string;

  @ApiProperty({
    example: 'MXN',
    description: 'Company currency',
  })
  currency: string;

  @ApiProperty({
    example: 'es-MX',
    description: 'Company language',
  })
  language: string;

  @ApiPropertyOptional({
    example: 'https://example.com/logo.png',
    description: 'Company logo URL',
  })
  logoUrl?: string;

  @ApiPropertyOptional({
    example: 'https://example.com',
    description: 'Company website URL',
  })
  websiteUrl?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/privacy',
    description: 'Company privacy policy URL',
  })
  privacyPolicyUrl?: string;

  @ApiProperty({
    enum: IndustrySectorEnum,
    example: IndustrySectorEnum.OTHER,
    description: 'Industry sector of the company',
  })
  industrySector: IndustrySectorEnum;

  @ApiProperty({
    enum: IndustryOperationChannelEnum,
    example: IndustryOperationChannelEnum.MIXED,
    description: 'Industry operation channel of the company',
  })
  industryOperationChannel: IndustryOperationChannelEnum;

  @ApiPropertyOptional({
    type: () => CompanySwaggerDto,
    description: 'Parent company information',
  })
  parentCompany?: CompanySwaggerDto;

  @ApiPropertyOptional({
    type: [CompanySwaggerDto],
    description: 'Subsidiary companies',
  })
  subsidiaries?: CompanySwaggerDto[];

  @ApiPropertyOptional({
    example: 0,
    description: 'Level in company hierarchy (0 = root company, 1 = first level subsidiary, etc.)',
  })
  hierarchyLevel?: number;

  @ApiPropertyOptional({
    type: [AssistantSwaggerDto],
    description: 'AI assistants assigned to the company',
  })
  assistants?: AssistantSwaggerDto[];

  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Company creation date',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Company last update date',
  })
  updatedAt: Date;
}
