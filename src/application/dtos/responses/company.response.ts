import { ApiProperty } from '@nestjs/swagger';
import { IndustrySectorEnum, IndustryOperationChannelEnum } from '@shared/constants/enums';

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
  industrySector: IndustrySectorEnum;
  industryOperationChannel: IndustryOperationChannelEnum;
  parentCompany?: ICompanyResponse;
  subsidiaries?: ICompanyResponse[];
  hierarchyLevel?: number;
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
