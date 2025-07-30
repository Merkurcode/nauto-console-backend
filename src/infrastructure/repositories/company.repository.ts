import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { Company } from '@core/entities/company.entity';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { CompanyName } from '@core/value-objects/company-name.vo';
import { Host } from '@core/value-objects/host.vo';
import { BaseRepository } from './base.repository';

@Injectable()
export class CompanyRepository extends BaseRepository<Company> implements ICompanyRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: CompanyId): Promise<Company | null> {
    return this.executeWithErrorHandling(
      'findById',
      async () => {
        const company = await this.prisma.company.findUnique({
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
        const company = await this.prisma.company.findUnique({
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
        const company = await this.prisma.company.findUnique({
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
        const companies = await this.prisma.company.findMany({
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

  async save(company: Company): Promise<Company> {
    return this.executeWithErrorHandling(
      'save',
      async () => {
        const createdCompany = await this.prisma.company.create({
          data: {
            id: company.id.getValue(),
            name: company.name.getValue(),
            description: company.description.getValue(),
            businessSector: company.businessSector.getValue(),
            businessUnit: company.businessUnit.getValue(),
            host: company.host.getValue(),
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
        const updatedCompany = await this.prisma.company.update({
          where: { id: company.id.getValue() },
          data: {
            name: company.name.getValue(),
            description: company.description.getValue(),
            businessSector: company.businessSector.getValue(),
            businessUnit: company.businessUnit.getValue(),
            host: company.host.getValue(),
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
        await this.prisma.company.delete({
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
        const count = await this.prisma.company.count({
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
        const count = await this.prisma.company.count({
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
        const count = await this.prisma.company.count({
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
    businessSector: string;
    businessUnit: string;
    host: string;
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
      businessSector: string;
      businessUnit: string;
      host: string;
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
      businessSector: string;
      businessUnit: string;
      host: string;
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
        businessSector: data.parentCompany.businessSector,
        businessUnit: data.parentCompany.businessUnit,
        host: data.parentCompany.host,
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
          businessSector: sub.businessSector,
          businessUnit: sub.businessUnit,
          host: sub.host,
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
      businessSector: data.businessSector,
      businessUnit: data.businessUnit,
      host: data.host,
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
        const companies = await this.prisma.company.findMany({
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
        const companies = await this.prisma.company.findMany({
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
        return await this.prisma.company.count({
          where: { parentCompanyId: parentId.getValue() },
        });
      },
      0,
    );
  }
}
