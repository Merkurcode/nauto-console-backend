import { Company } from '@core/entities/company.entity';
import {
  ICompanyResponse,
  IAddressResponse,
  IAssistantResponse,
} from '@application/dtos/_responses/company/company.response';
import { ICompanyWeeklyScheduleResponse } from '@application/dtos/_responses/company-schedules/company-schedule.response.interface';
import { IAIPersonaResponse } from '@application/dtos/_responses/ai-persona/ai-persona.response.interface';

import { IAssistantAssignment } from '@core/repositories/company.repository.interface';

export class CompanyMapper {
  static toResponse(
    company: Company,
    assistants?: IAssistantAssignment[],
    weeklySchedule?: ICompanyWeeklyScheduleResponse,
    activeAIPersona?: IAIPersonaResponse | null,
  ): ICompanyResponse {
    return {
      id: company.id.getValue(),
      name: company.name.getValue(),
      description: company.description.getValue(),
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
      weeklySchedule: weeklySchedule,
      activeAIPersona: activeAIPersona,
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
    assistantsMap?: Map<string, IAssistantAssignment[]>,
    weeklyScheduleMap?: Map<string, ICompanyWeeklyScheduleResponse>,
    activeAIPersonaMap?: Map<string, IAIPersonaResponse | null>,
  ): ICompanyResponse[] {
    return companies.map(company =>
      this.toResponse(
        company,
        assistantsMap?.get(company.id.getValue()),
        weeklyScheduleMap?.get(company.id.getValue()),
        activeAIPersonaMap?.get(company.id.getValue()),
      ),
    );
  }

  private static mapAssistants(assistants: IAssistantAssignment[]): IAssistantResponse[] {
    return assistants.map(assignment => ({
      id: assignment.aiAssistant.id,
      name: assignment.aiAssistant.name,
      area: assignment.aiAssistant.area,
      description: assignment.aiAssistant.description as Record<string, string>,
      enabled: assignment.enabled,
      features:
        assignment.features?.map(feature => ({
          id: feature.aiAssistantFeature.id,
          keyName: feature.aiAssistantFeature.keyName,
          title: feature.aiAssistantFeature.title as Record<string, string>,
          description: feature.aiAssistantFeature.description as Record<string, string>,
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
    googleMapsUrl?: string;
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
      googleMapsUrl: address.googleMapsUrl,
    };
  }
}
