import { Company } from '@core/entities/company.entity';
import { ICompanyResponse, IAddressResponse } from '@application/dtos/responses/company.response';

export class CompanyMapper {
  static toResponse(company: Company): ICompanyResponse {
    return {
      id: company.id.getValue(),
      name: company.name.getValue(),
      description: company.description.getValue(),
      businessSector: company.businessSector.getValue(),
      businessUnit: company.businessUnit.getValue(),
      host: company.host.getValue(),
      address: this.mapAddressToResponse(company.address),
      isActive: company.isActive,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
  }

  static toListResponse(companies: Company[]): ICompanyResponse[] {
    return companies.map(company => this.toResponse(company));
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
