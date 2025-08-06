import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { ICompanySchedulesRepository } from '@core/repositories/company-schedules.repository.interface';
import { CompanySchedules } from '@core/entities/company-schedules.entity';
import { CompanyScheduleId } from '@core/value-objects/company-schedule-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';

// Prisma record interface for company schedules
interface IPrismaCompanyScheduleRecord {
  id: string;
  dayOfWeek: number;
  startTime: Date;
  endTime: Date;
  isActive: boolean;
  companyId: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CompanySchedulesRepository implements ICompanySchedulesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: CompanyScheduleId): Promise<CompanySchedules | null> {
    const record = await this.prisma.companySchedules.findUnique({
      where: { id: id.getValue() },
    });

    return record ? this.toDomain(record) : null;
  }

  async findByCompanyId(companyId: CompanyId): Promise<CompanySchedules[]> {
    const records = await this.prisma.companySchedules.findMany({
      where: { companyId: companyId.getValue() },
      orderBy: { dayOfWeek: 'asc' },
    });

    return records.map(record => this.toDomain(record));
  }

  async findActiveByCompanyId(companyId: CompanyId): Promise<CompanySchedules[]> {
    const records = await this.prisma.companySchedules.findMany({
      where: {
        companyId: companyId.getValue(),
        isActive: true,
      },
      orderBy: { dayOfWeek: 'asc' },
    });

    return records.map(record => this.toDomain(record));
  }

  async findByCompanyIdAndDayOfWeek(
    companyId: CompanyId,
    dayOfWeek: number,
  ): Promise<CompanySchedules | null> {
    const record = await this.prisma.companySchedules.findUnique({
      where: {
        companyId_dayOfWeek: {
          companyId: companyId.getValue(),
          dayOfWeek,
        },
      },
    });

    return record ? this.toDomain(record) : null;
  }

  async existsByCompanyIdAndDayOfWeek(companyId: CompanyId, dayOfWeek: number): Promise<boolean> {
    const count = await this.prisma.companySchedules.count({
      where: {
        companyId: companyId.getValue(),
        dayOfWeek,
      },
    });

    return count > 0;
  }

  async create(schedule: CompanySchedules): Promise<CompanySchedules> {
    const persistenceData = schedule.toPersistence();

    const record = await this.prisma.companySchedules.create({
      data: {
        id: persistenceData.id as string,
        dayOfWeek: persistenceData.dayOfWeek as number,
        startTime: persistenceData.startTime as Date,
        endTime: persistenceData.endTime as Date,
        isActive: persistenceData.isActive as boolean,
        companyId: persistenceData.companyId as string,
      },
    });

    return this.toDomain(record);
  }

  async update(schedule: CompanySchedules): Promise<CompanySchedules> {
    const persistenceData = schedule.toPersistence();

    const record = await this.prisma.companySchedules.update({
      where: { id: persistenceData.id as string },
      data: {
        dayOfWeek: persistenceData.dayOfWeek as number,
        startTime: persistenceData.startTime as Date,
        endTime: persistenceData.endTime as Date,
        isActive: persistenceData.isActive as boolean,
        updatedAt: new Date(),
      },
    });

    return this.toDomain(record);
  }

  async delete(id: CompanyScheduleId): Promise<void> {
    await this.prisma.companySchedules.delete({
      where: { id: id.getValue() },
    });
  }

  async findMany(filters: {
    companyId?: CompanyId;
    isActive?: boolean;
    dayOfWeek?: number;
    timeRange?: {
      startTime: Date;
      endTime: Date;
    };
    limit?: number;
    offset?: number;
  }): Promise<{
    schedules: CompanySchedules[];
    total: number;
  }> {
    const where = {
      ...(filters.companyId && { companyId: filters.companyId.getValue() }),
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
      ...(filters.dayOfWeek !== undefined && { dayOfWeek: filters.dayOfWeek }),
      ...(filters.timeRange && {
        OR: [
          {
            AND: [
              { startTime: { lte: filters.timeRange.endTime } },
              { endTime: { gte: filters.timeRange.startTime } },
            ],
          },
        ],
      }),
    };

    const [records, total] = await Promise.all([
      this.prisma.companySchedules.findMany({
        where,
        take: filters.limit || 50,
        skip: filters.offset || 0,
        orderBy: { dayOfWeek: 'asc' },
      }),
      this.prisma.companySchedules.count({ where }),
    ]);

    return {
      schedules: records.map(record => this.toDomain(record)),
      total,
    };
  }

  async getWeeklySchedule(companyId: CompanyId): Promise<CompanySchedules[]> {
    const records = await this.prisma.companySchedules.findMany({
      where: {
        companyId: companyId.getValue(),
        isActive: true,
      },
      orderBy: { dayOfWeek: 'asc' },
    });

    return records.map(record => this.toDomain(record));
  }

  async hasTimeConflict(
    companyId: CompanyId,
    dayOfWeek: number,
    startTime: Date,
    endTime: Date,
    excludeId?: CompanyScheduleId,
  ): Promise<boolean> {
    const where = {
      companyId: companyId.getValue(),
      dayOfWeek,
      isActive: true,
      ...(excludeId && { id: { not: excludeId.getValue() } }),
      OR: [
        {
          AND: [{ startTime: { lte: startTime } }, { endTime: { gt: startTime } }],
        },
        {
          AND: [{ startTime: { lt: endTime } }, { endTime: { gte: endTime } }],
        },
        {
          AND: [{ startTime: { gte: startTime } }, { endTime: { lte: endTime } }],
        },
      ],
    };

    const count = await this.prisma.companySchedules.count({ where });

    return count > 0;
  }

  async bulkUpdateActiveStatus(
    companyId: CompanyId,
    scheduleIds: CompanyScheduleId[],
    isActive: boolean,
  ): Promise<void> {
    const ids = scheduleIds.map(id => id.getValue());

    await this.prisma.companySchedules.updateMany({
      where: {
        companyId: companyId.getValue(),
        id: { in: ids },
      },
      data: {
        isActive,
        updatedAt: new Date(),
      },
    });
  }

  async deleteByCompanyId(companyId: CompanyId): Promise<void> {
    await this.prisma.companySchedules.deleteMany({
      where: { companyId: companyId.getValue() },
    });
  }

  private toDomain(record: IPrismaCompanyScheduleRecord): CompanySchedules {
    return CompanySchedules.reconstruct(CompanyScheduleId.fromString(record.id), {
      dayOfWeek: record.dayOfWeek,
      startTime: record.startTime,
      endTime: record.endTime,
      isActive: record.isActive,
      companyId: CompanyId.fromString(record.companyId),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
