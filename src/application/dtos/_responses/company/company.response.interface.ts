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

export interface ITenantIdResponse {
  tenantId: string;
  host: string;
}
