import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { ICompanyEventsCatalogRepository } from '@core/repositories/company-events-catalog.repository.interface';
import { CompanyEventsCatalog } from '@core/entities/company-events-catalog.entity';
import { CompanyEventId } from '@core/value-objects/company-event-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';

@Injectable()
export class CompanyEventsCatalogRepository implements ICompanyEventsCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: CompanyEventId): Promise<CompanyEventsCatalog | null> {
    // Note: Since the schema uses a compound unique key (companyId_eventName),
    // we can't directly find by ID. This method searches by eventName but might
    // return the wrong record if multiple companies have the same eventName.
    // In practice, this should be called with context or use a different approach.
    const record = await this.prisma.companyEventsCatalog.findFirst({
      where: { eventName: id.getValue() },
    });

    return record ? this.toDomain(record) : null;
  }

  async findByCompanyId(companyId: CompanyId): Promise<CompanyEventsCatalog[]> {
    const records = await this.prisma.companyEventsCatalog.findMany({
      where: { companyId: companyId.getValue() },
      orderBy: { eventName: 'asc' },
    });

    return records.map(record => this.toDomain(record));
  }

  async findActiveByCompanyId(companyId: CompanyId): Promise<CompanyEventsCatalog[]> {
    const records = await this.prisma.companyEventsCatalog.findMany({
      where: {
        companyId: companyId.getValue(),
        isActive: true,
      },
      orderBy: { eventName: 'asc' },
    });

    return records.map(record => this.toDomain(record));
  }

  async findByCompanyIdAndEventName(
    companyId: CompanyId,
    eventName: string,
  ): Promise<CompanyEventsCatalog | null> {
    const standardizedEventName = CompanyEventsCatalog.standardizeEventName(eventName);

    const record = await this.prisma.companyEventsCatalog.findUnique({
      where: {
        companyId_eventName: {
          companyId: companyId.getValue(),
          eventName: standardizedEventName,
        },
      },
    });

    return record ? this.toDomain(record) : null;
  }

  async existsByCompanyIdAndEventName(companyId: CompanyId, eventName: string): Promise<boolean> {
    const standardizedEventName = CompanyEventsCatalog.standardizeEventName(eventName);

    const count = await this.prisma.companyEventsCatalog.count({
      where: {
        companyId: companyId.getValue(),
        eventName: standardizedEventName,
      },
    });

    return count > 0;
  }

  async create(eventCatalog: CompanyEventsCatalog): Promise<CompanyEventsCatalog> {
    const persistenceData = eventCatalog.toPersistence();

    const record = await this.prisma.companyEventsCatalog.create({
      data: {
        title: persistenceData.title as any,
        description: persistenceData.description as any,
        iconUrl: persistenceData.iconUrl as string,
        color: persistenceData.color as string,
        isActive: persistenceData.isActive as boolean,
        isOnline: persistenceData.isOnline as boolean,
        isPhysical: persistenceData.isPhysical as boolean,
        isAppointment: persistenceData.isAppointment as boolean,
        eventName: persistenceData.eventName as string,
        companyId: persistenceData.companyId as string,
      },
    });

    return this.toDomain(record);
  }

  async update(eventCatalog: CompanyEventsCatalog): Promise<CompanyEventsCatalog> {
    const persistenceData = eventCatalog.toPersistence();

    const record = await this.prisma.companyEventsCatalog.update({
      where: {
        companyId_eventName: {
          companyId: persistenceData.companyId as string,
          eventName: persistenceData.eventName as string,
        },
      },
      data: {
        title: persistenceData.title as any,
        description: persistenceData.description as any,
        iconUrl: persistenceData.iconUrl as string,
        color: persistenceData.color as string,
        isActive: persistenceData.isActive as boolean,
        isOnline: persistenceData.isOnline as boolean,
        isPhysical: persistenceData.isPhysical as boolean,
        isAppointment: persistenceData.isAppointment as boolean,
        updatedAt: new Date(),
      },
    });

    return this.toDomain(record);
  }

  async delete(id: CompanyEventId): Promise<void> {
    // Since we don't have a simple ID field, we need to find the record first
    const record = await this.prisma.companyEventsCatalog.findFirst({
      where: { eventName: id.getValue() },
    });

    if (record) {
      await this.prisma.companyEventsCatalog.delete({
        where: {
          companyId_eventName: {
            companyId: record.companyId,
            eventName: record.eventName,
          },
        },
      });
    }
  }

  async findMany(filters: {
    companyId?: CompanyId;
    isActive?: boolean;
    isOnline?: boolean;
    isPhysical?: boolean;
    isAppointment?: boolean;
    eventNamePattern?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    events: CompanyEventsCatalog[];
    total: number;
  }> {
    const where = {
      ...(filters.companyId && { companyId: filters.companyId.getValue() }),
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
      ...(filters.isOnline !== undefined && { isOnline: filters.isOnline }),
      ...(filters.isPhysical !== undefined && { isPhysical: filters.isPhysical }),
      ...(filters.isAppointment !== undefined && { isAppointment: filters.isAppointment }),
      ...(filters.eventNamePattern && {
        eventName: {
          contains: filters.eventNamePattern,
          mode: 'insensitive' as const,
        },
      }),
    };

    const [records, total] = await Promise.all([
      this.prisma.companyEventsCatalog.findMany({
        where,
        take: filters.limit || 50,
        skip: filters.offset || 0,
        orderBy: { eventName: 'asc' },
      }),
      this.prisma.companyEventsCatalog.count({ where }),
    ]);

    return {
      events: records.map(record => this.toDomain(record)),
      total,
    };
  }

  async bulkUpdateActiveStatus(
    companyId: CompanyId,
    eventIds: CompanyEventId[],
    isActive: boolean,
  ): Promise<void> {
    const eventNames = eventIds.map(id => id.getValue());

    await this.prisma.companyEventsCatalog.updateMany({
      where: {
        companyId: companyId.getValue(),
        eventName: { in: eventNames },
      },
      data: {
        isActive,
        updatedAt: new Date(),
      },
    });
  }

  private toDomain(record: any): CompanyEventsCatalog {
    return CompanyEventsCatalog.reconstruct(
      CompanyEventId.fromString(record.eventName), // Using eventName as unique identifier
      {
        title: record.title,
        description: record.description,
        iconUrl: record.iconUrl,
        color: record.color,
        isActive: record.isActive,
        isOnline: record.isOnline,
        isPhysical: record.isPhysical,
        isAppointment: record.isAppointment,
        eventName: record.eventName,
        companyId: CompanyId.fromString(record.companyId),
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    );
  }
}
