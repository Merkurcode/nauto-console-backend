import { Company } from '@core/entities/company.entity';
import {
  ICompanyResponse,
  IAddressResponse,
  IAssistantResponse,
} from '@application/dtos/responses/company.response';

export class CompanyMapper {
  static toResponse(company: Company, assistants?: any[]): ICompanyResponse {
    return {
      id: company.id.getValue(),
      name: company.name.getValue(),
      description: company.description.getValue(),
      businessSector: company.businessSector.getValue(),
      businessUnit: company.businessUnit.getValue(),
      host: company.host.getValue(),
      address: this.mapAddressToResponse(company.address),
      isActive: company.isActive,
      industrySector: company.industrySector.value,
      industryOperationChannel: company.industryOperationChannel.value,
      timezone: company.timezone,
      currency: company.currency,
      language: company.language,
      logoUrl: company.logoUrl,
      websiteUrl: company.websiteUrl,
      privacyPolicyUrl: company.privacyPolicyUrl,
      parentCompany: company.parentCompany
        ? this.toBasicResponse(company.parentCompany)
        : undefined,
      subsidiaries:
        company.subsidiaries.length > 0
          ? company.subsidiaries.map(sub => this.toBasicResponse(sub))
          : undefined,
      hierarchyLevel: company.getHierarchyLevel(),
      assistants: assistants ? this.mapAssistants(assistants) : undefined,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
  }

  // Basic response without nested relationships to avoid circular references
  static toBasicResponse(company: Company): ICompanyResponse {
    return {
      id: company.id.getValue(),
      name: company.name.getValue(),
      description: company.description.getValue(),
      businessSector: company.businessSector.getValue(),
      businessUnit: company.businessUnit.getValue(),
      host: company.host.getValue(),
      address: this.mapAddressToResponse(company.address),
      isActive: company.isActive,
      timezone: company.timezone,
      currency: company.currency,
      language: company.language,
      logoUrl: company.logoUrl,
      websiteUrl: company.websiteUrl,
      privacyPolicyUrl: company.privacyPolicyUrl,
      industrySector: company.industrySector.value,
      industryOperationChannel: company.industryOperationChannel.value,
      hierarchyLevel: company.getHierarchyLevel(),
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
  }

  static toListResponse(
    companies: Company[],
    assistantsMap?: Map<string, any[]>,
  ): ICompanyResponse[] {
    return companies.map(company =>
      this.toResponse(company, assistantsMap?.get(company.id.getValue())),
    );
  }

  private static mapAssistants(assistants: any[]): IAssistantResponse[] {
    return assistants.map(assignment => ({
      id: assignment.aiAssistant.id,
      name: assignment.aiAssistant.name,
      area: assignment.aiAssistant.area,
      description: assignment.aiAssistant.description,
      enabled: assignment.enabled,
      features:
        assignment.features?.map((feature: any) => ({
          id: feature.aiAssistantFeature.id,
          keyName: feature.aiAssistantFeature.keyName,
          title: feature.aiAssistantFeature.title,
          description: feature.aiAssistantFeature.description,
          enabled: feature.enabled,
        })) || [],
    }));
  }

  private static mapAddressToResponse(address: {
    country: string;
    state: string;
    city: string;
    street: string;
    exteriorNumber: string;
    interiorNumber?: string;
    postalCode: string;
    getFullAddress(): string;
  }): IAddressResponse {
    return {
      country: address.country,
      state: address.state,
      city: address.city,
      street: address.street,
      exteriorNumber: address.exteriorNumber,
      interiorNumber: address.interiorNumber,
      postalCode: address.postalCode,
      fullAddress: address.getFullAddress(),
    };
  }
}
