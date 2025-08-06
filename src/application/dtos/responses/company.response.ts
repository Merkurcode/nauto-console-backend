import { ApiProperty } from '@nestjs/swagger';
import { IndustrySectorEnum, IndustryOperationChannelEnum } from '@shared/constants/enums';

export interface IAssistantFeatureResponse {
  id: string;
  keyName: string;
  title: Record<string, string>;
  description: Record<string, string>;
  enabled: boolean;
}

export interface IAssistantResponse {
  id: string;
  name: string;
  area: string;
  description: Record<string, string>;
  enabled: boolean;
  features: IAssistantFeatureResponse[];
}

export interface IAddressResponse {
  country: string;
  state: string;
  city: string;
  street: string;
  exteriorNumber: string;
  interiorNumber?: string;
  postalCode: string;
  fullAddress: string;
}

export interface ICompanyResponse {
  id: string;
  name: string;
  description: string;
  businessSector: string;
  businessUnit: string;
  host: string;
  address: IAddressResponse;
  isActive: boolean;
  timezone: string;
  currency: string;
  language: string;
  logoUrl?: string;
  websiteUrl?: string;
  privacyPolicyUrl?: string;
  industrySector: IndustrySectorEnum;
  industryOperationChannel: IndustryOperationChannelEnum;
  parentCompany?: ICompanyResponse;
  subsidiaries?: ICompanyResponse[];
  hierarchyLevel?: number;
  assistants?: IAssistantResponse[];
  createdAt: Date;
  updatedAt: Date;
}

export class AddressResponse implements IAddressResponse {
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

  @ApiProperty({
    example: 'A',
    description: 'Interior number',
    required: false,
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

export interface ITenantIdResponse {
  tenantId: string;
  host: string;
}

export class TenantIdResponse implements ITenantIdResponse {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Tenant unique identifier',
  })
  tenantId: string;

  @ApiProperty({
    example: 'acme-corp.com',
    description: 'Host domain associated with the tenant',
  })
  host: string;
}

export class CompanyResponse implements ICompanyResponse {
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
    example: 'Technology',
    description: 'Business sector',
  })
  businessSector: string;

  @ApiProperty({
    example: 'Software Development',
    description: 'Business unit',
  })
  businessUnit: string;

  @ApiProperty({
    example: 'acme-corp.com',
    description: 'Company host domain',
  })
  host: string;

  @ApiProperty({
    type: AddressResponse,
    description: 'Company address',
  })
  address: AddressResponse;

  @ApiProperty({
    example: true,
    description: 'Whether the company is active',
  })
  isActive: boolean;

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

  @ApiProperty({
    example: 'https://example.com/logo.png',
    description: 'Company logo URL',
    required: false,
  })
  logoUrl?: string;

  @ApiProperty({
    example: 'https://example.com',
    description: 'Company website URL',
    required: false,
  })
  websiteUrl?: string;

  @ApiProperty({
    example: 'https://example.com/privacy',
    description: 'Company privacy policy URL',
    required: false,
  })
  privacyPolicyUrl?: string;

  @ApiProperty({
    type: 'array',
    description: 'AI assistants assigned to the company',
    required: false,
  })
  assistants?: IAssistantResponse[];

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

  @ApiProperty({
    type: () => CompanyResponse,
    description: 'Parent company information',
    required: false,
  })
  parentCompany?: CompanyResponse;

  @ApiProperty({
    type: [CompanyResponse],
    description: 'Subsidiary companies',
    required: false,
  })
  subsidiaries?: CompanyResponse[];

  @ApiProperty({
    example: 0,
    description: 'Level in company hierarchy (0 = root company, 1 = first level subsidiary, etc.)',
    required: false,
  })
  hierarchyLevel?: number;
}

export class AssistantFeatureResponse implements IAssistantFeatureResponse {
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

export class AssistantResponse implements IAssistantResponse {
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
    type: [AssistantFeatureResponse],
    description: 'Features available for this assistant',
  })
  features: AssistantFeatureResponse[];
}
