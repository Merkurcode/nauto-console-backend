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
            isActive: company.isActive,
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
            isActive: company.isActive,
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
  }): Company {
    return Company.fromData({
      id: data.id,
      name: data.name,
      description: data.description,
      businessSector: data.businessSector,
      businessUnit: data.businessUnit,
      host: data.host,
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
    });
  }
}
