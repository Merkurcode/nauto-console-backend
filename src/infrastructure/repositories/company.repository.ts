import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import {
  ICompanyRepository,
  IAssistantAssignment,
} from '@core/repositories/company.repository.interface';
import { Company } from '@core/entities/company.entity';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { CompanyName } from '@core/value-objects/company-name.vo';
import { Host } from '@core/value-objects/host.vo';

// Prisma company record interface
interface IPrismaCompanyRecord {
  id: string;
  name: string;
  description: string;
  host: string;
  timezone?: string;
  currency?: string;
  language?: string;
  logoUrl?: string;
  websiteUrl?: string;
  privacyPolicyUrl?: string;
  industrySector?: string;
  industryOperationChannel?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  address: {
    country: string;
    state: string;
    city: string;
    street: string;
    exteriorNumber: string;
    interiorNumber?: string;
    postalCode: string;
  };
  parentCompany?: IPrismaCompanyRecord;
  subsidiaries?: IPrismaCompanyRecord[];
}
import { BaseRepository } from './base.repository';

@Injectable()
export class CompanyRepository extends BaseRepository<Company> implements ICompanyRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionContext: TransactionContextService,
  ) {
    super();
  }

  private get client() {
    return this.transactionContext.getTransactionClient() || this.prisma;
  }

  async findById(id: CompanyId): Promise<Company | null> {
    return this.executeWithErrorHandling(
      'findById',
      async () => {
        const company = await this.client.company.findUnique({
          where: { id: id.getValue() },
          include: {
            address: true,
            parentCompany: {
              include: {
                address: true,
              },
            },
            subsidiaries: {
              include: {
                address: true,
              },
            },
          },
        });

        return company ? this.mapToModel(company) : null;
      },
      null,
    );
  }

  async findByName(name: CompanyName): Promise<Company | null> {
    return this.executeWithErrorHandling(
      'findByName',
      async () => {
        const company = await this.client.company.findUnique({
          where: { name: name.getValue() },
          include: {
            address: true,
            parentCompany: {
              include: {
                address: true,
              },
            },
            subsidiaries: {
              include: {
                address: true,
              },
            },
          },
        });

        return company ? this.mapToModel(company) : null;
      },
      null,
    );
  }

  async findByHost(host: Host): Promise<Company | null> {
    return this.executeWithErrorHandling(
      'findByHost',
      async () => {
        const company = await this.client.company.findUnique({
          where: { host: host.getValue() },
          include: {
            address: true,
            parentCompany: {
              include: {
                address: true,
              },
            },
            subsidiaries: {
              include: {
                address: true,
              },
            },
          },
        });

        return company ? this.mapToModel(company) : null;
      },
      null,
    );
  }

  async findAll(): Promise<Company[]> {
    return this.executeWithErrorHandling(
      'findAll',
      async () => {
        const companies = await this.client.company.findMany({
          include: {
            address: true,
            parentCompany: {
              include: {
                address: true,
              },
            },
            subsidiaries: {
              include: {
                address: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        return companies.map(company => this.mapToModel(company));
      },
      [],
    );
  }

  async findAllWithAssistants(): Promise<{
    companies: Company[];
    assistantsMap: Map<string, IAssistantAssignment[]>;
  }> {
    return this.executeWithErrorHandling(
      'findAllWithAssistants',
      async () => {
        const companies = await this.client.company.findMany({
          include: {
            address: true,
            parentCompany: {
              include: {
                address: true,
              },
            },
            subsidiaries: {
              include: {
                address: true,
              },
            },
            assistants: {
              include: {
                aiAssistant: {
                  include: {
                    features: true,
                  },
                },
                features: {
                  include: {
                    aiAssistantFeature: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        const assistantsMap = new Map<string, IAssistantAssignment[]>();
        const companiesData = companies.map(company => {
          // Extract assistants data
          if (company.assistants && company.assistants.length > 0) {
            assistantsMap.set(company.id, company.assistants);
          }

          // Return company without assistants to avoid circular references in entity
          const { assistants: _assistants, ...companyWithoutAssistants } = company;

          return companyWithoutAssistants;
        });

        return {
          companies: companiesData.map(company => this.mapToModel(company as IPrismaCompanyRecord)),
          assistantsMap,
        };
      },
      { companies: [], assistantsMap: new Map() },
    );
  }

  async findByIdWithAssistants(
    id: CompanyId,
  ): Promise<{ company: Company | null; assistants: IAssistantAssignment[] }> {
    return this.executeWithErrorHandling(
      'findByIdWithAssistants',
      async () => {
        const company = await this.client.company.findUnique({
          where: { id: id.getValue() },
          include: {
            address: true,
            parentCompany: {
              include: {
                address: true,
              },
            },
            subsidiaries: {
              include: {
                address: true,
              },
            },
            assistants: {
              include: {
                aiAssistant: {
                  include: {
                    features: true,
                  },
                },
                features: {
                  include: {
                    aiAssistantFeature: true,
                  },
                },
              },
            },
          },
        });

        if (!company) {
          return { company: null, assistants: [] };
        }

        const assistants = company.assistants || [];
        const { assistants: _, ...companyWithoutAssistants } = company;

        return {
          company: this.mapToModel(companyWithoutAssistants as IPrismaCompanyRecord),
          assistants,
        };
      },
      { company: null, assistants: [] },
    );
  }

  async save(company: Company): Promise<Company> {
    return this.executeWithErrorHandling(
      'save',
      async () => {
        const createdCompany = await this.client.company.create({
          data: {
            id: company.id.getValue(),
            name: company.name.getValue(),
            description: company.description.getValue(),
            host: company.host.getValue(),
            timezone: company.timezone,
            currency: company.currency,
            language: company.language,
            logoUrl: company.logoUrl,
            websiteUrl: company.websiteUrl,
            privacyPolicyUrl: company.privacyPolicyUrl,
            industrySector: company.industrySector.value,
            industryOperationChannel: company.industryOperationChannel.value,
            isActive: company.isActive,
            parentCompanyId: company.parentCompany?.id.getValue(),
            createdAt: company.createdAt,
            updatedAt: company.updatedAt,
            address: {
              create: {
                country: company.address.country,
                state: company.address.state,
                city: company.address.city,
                street: company.address.street,
                exteriorNumber: company.address.exteriorNumber,
                interiorNumber: company.address.interiorNumber,
                postalCode: company.address.postalCode,
              },
            },
          },
          include: {
            address: true,
            parentCompany: {
              include: {
                address: true,
              },
            },
            subsidiaries: {
              include: {
                address: true,
              },
            },
          },
        });

        return this.mapToModel(createdCompany);
      },
      company,
    );
  }

  async update(company: Company): Promise<Company> {
    return this.executeWithErrorHandling(
      'update',
      async () => {
        const updatedCompany = await this.client.company.update({
          where: { id: company.id.getValue() },
          data: {
            name: company.name.getValue(),
            description: company.description.getValue(),
            host: company.host.getValue(),
            timezone: company.timezone,
            currency: company.currency,
            language: company.language,
            logoUrl: company.logoUrl,
            websiteUrl: company.websiteUrl,
            privacyPolicyUrl: company.privacyPolicyUrl,
            industrySector: company.industrySector.value,
            industryOperationChannel: company.industryOperationChannel.value,
            isActive: company.isActive,
            parentCompanyId: company.parentCompany?.id.getValue(),
            updatedAt: company.updatedAt,
            address: {
              update: {
                country: company.address.country,
                state: company.address.state,
                city: company.address.city,
                street: company.address.street,
                exteriorNumber: company.address.exteriorNumber,
                interiorNumber: company.address.interiorNumber,
                postalCode: company.address.postalCode,
              },
            },
          },
          include: {
            address: true,
            parentCompany: {
              include: {
                address: true,
              },
            },
            subsidiaries: {
              include: {
                address: true,
              },
            },
          },
        });

        return this.mapToModel(updatedCompany);
      },
      company,
    );
  }

  async delete(id: CompanyId): Promise<void> {
    return this.executeWithErrorHandling(
      'delete',
      async () => {
        await this.client.company.delete({
          where: { id: id.getValue() },
        });
      },
      undefined,
    );
  }

  async exists(id: CompanyId): Promise<boolean> {
    return this.executeWithErrorHandling(
      'exists',
      async () => {
        const count = await this.client.company.count({
          where: { id: id.getValue() },
        });

        return count > 0;
      },
      false,
    );
  }

  async existsByName(name: CompanyName): Promise<boolean> {
    return this.executeWithErrorHandling(
      'existsByName',
      async () => {
        const count = await this.client.company.count({
          where: { name: name.getValue() },
        });

        return count > 0;
      },
      false,
    );
  }

  async existsByHost(host: Host): Promise<boolean> {
    return this.executeWithErrorHandling(
      'existsByHost',
      async () => {
        const count = await this.client.company.count({
          where: { host: host.getValue() },
        });

        return count > 0;
      },
      false,
    );
  }

  private mapToModel(data: {
    id: string;
    name: string;
    description: string;
    host: string;
    timezone?: string;
    currency?: string;
    language?: string;
    logoUrl?: string;
    websiteUrl?: string;
    privacyPolicyUrl?: string;
    industrySector?: string;
    industryOperationChannel?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    address: {
      country: string;
      state: string;
      city: string;
      street: string;
      exteriorNumber: string;
      interiorNumber?: string;
      postalCode: string;
    };
    parentCompany?: {
      id: string;
      name: string;
      description: string;
      host: string;
      timezone?: string;
      currency?: string;
      language?: string;
      logoUrl?: string;
      websiteUrl?: string;
      privacyPolicyUrl?: string;
      industrySector?: string;
      industryOperationChannel?: string;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
      address: {
        country: string;
        state: string;
        city: string;
        street: string;
        exteriorNumber: string;
        interiorNumber?: string;
        postalCode: string;
      };
    } | null;
    subsidiaries?: Array<{
      id: string;
      name: string;
      description: string;
      host: string;
      timezone?: string;
      currency?: string;
      language?: string;
      logoUrl?: string;
      websiteUrl?: string;
      privacyPolicyUrl?: string;
      industrySector?: string;
      industryOperationChannel?: string;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
      address: {
        country: string;
        state: string;
        city: string;
        street: string;
        exteriorNumber: string;
        interiorNumber?: string;
        postalCode: string;
      };
    }>;
  }): Company {
    // First create parent company if exists (to avoid circular references)
    let parentCompany: Company | undefined;
    if (data.parentCompany) {
      parentCompany = Company.fromData({
        id: data.parentCompany.id,
        name: data.parentCompany.name,
        description: data.parentCompany.description,
        host: data.parentCompany.host,
        timezone: data.parentCompany.timezone,
        currency: data.parentCompany.currency,
        language: data.parentCompany.language,
        logoUrl: data.parentCompany.logoUrl,
        websiteUrl: data.parentCompany.websiteUrl,
        privacyPolicyUrl: data.parentCompany.privacyPolicyUrl,
        industrySector: data.parentCompany.industrySector
          ? String(data.parentCompany.industrySector)
          : undefined,
        industryOperationChannel: data.parentCompany.industryOperationChannel
          ? String(data.parentCompany.industryOperationChannel)
          : undefined,
        address: {
          country: data.parentCompany.address.country,
          state: data.parentCompany.address.state,
          city: data.parentCompany.address.city,
          street: data.parentCompany.address.street,
          exteriorNumber: data.parentCompany.address.exteriorNumber,
          interiorNumber: data.parentCompany.address.interiorNumber,
          postalCode: data.parentCompany.address.postalCode,
        },
        isActive: data.parentCompany.isActive,
        createdAt: data.parentCompany.createdAt,
        updatedAt: data.parentCompany.updatedAt,
      });
    }

    // Create subsidiaries
    let subsidiaries: Company[] | undefined;
    if (data.subsidiaries) {
      subsidiaries = data.subsidiaries.map(sub =>
        Company.fromData({
          id: sub.id,
          name: sub.name,
          description: sub.description,
          host: sub.host,
          timezone: sub.timezone,
          currency: sub.currency,
          language: sub.language,
          logoUrl: sub.logoUrl,
          websiteUrl: sub.websiteUrl,
          privacyPolicyUrl: sub.privacyPolicyUrl,
          industrySector: sub.industrySector ? String(sub.industrySector) : undefined,
          industryOperationChannel: sub.industryOperationChannel
            ? String(sub.industryOperationChannel)
            : undefined,
          address: {
            country: sub.address.country,
            state: sub.address.state,
            city: sub.address.city,
            street: sub.address.street,
            exteriorNumber: sub.address.exteriorNumber,
            interiorNumber: sub.address.interiorNumber,
            postalCode: sub.address.postalCode,
          },
          isActive: sub.isActive,
          createdAt: sub.createdAt,
          updatedAt: sub.updatedAt,
        }),
      );
    }

    return Company.fromData({
      id: data.id,
      name: data.name,
      description: data.description,
      host: data.host,
      timezone: data.timezone,
      currency: data.currency,
      language: data.language,
      logoUrl: data.logoUrl,
      websiteUrl: data.websiteUrl,
      privacyPolicyUrl: data.privacyPolicyUrl,
      industrySector: data.industrySector ? String(data.industrySector) : undefined,
      industryOperationChannel: data.industryOperationChannel
        ? String(data.industryOperationChannel)
        : undefined,
      address: {
        country: data.address.country,
        state: data.address.state,
        city: data.address.city,
        street: data.address.street,
        exteriorNumber: data.address.exteriorNumber,
        interiorNumber: data.address.interiorNumber,
        postalCode: data.address.postalCode,
      },
      isActive: data.isActive,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      parentCompany,
      subsidiaries,
    });
  }

  // Hierarchy methods implementation
  async findSubsidiaries(parentId: CompanyId): Promise<Company[]> {
    return this.executeWithErrorHandling(
      'findSubsidiaries',
      async () => {
        const companies = await this.client.company.findMany({
          where: { parentCompanyId: parentId.getValue() },
          include: {
            address: true,
            parentCompany: {
              include: {
                address: true,
              },
            },
            subsidiaries: {
              include: {
                address: true,
              },
            },
          },
        });

        return companies.map(company => this.mapToModel(company));
      },
      [],
    );
  }

  async findRootCompanies(): Promise<Company[]> {
    return this.executeWithErrorHandling(
      'findRootCompanies',
      async () => {
        const companies = await this.client.company.findMany({
          where: { parentCompanyId: null },
          include: {
            address: true,
            parentCompany: {
              include: {
                address: true,
              },
            },
            subsidiaries: {
              include: {
                address: true,
              },
            },
          },
        });

        return companies.map(company => this.mapToModel(company));
      },
      [],
    );
  }

  async findByParentCompany(parentId: CompanyId): Promise<Company[]> {
    return this.findSubsidiaries(parentId);
  }

  async countSubsidiaries(parentId: CompanyId): Promise<number> {
    return this.executeWithErrorHandling(
      'countSubsidiaries',
      async () => {
        return await this.client.company.count({
          where: { parentCompanyId: parentId.getValue() },
        });
      },
      0,
    );
  }
}
