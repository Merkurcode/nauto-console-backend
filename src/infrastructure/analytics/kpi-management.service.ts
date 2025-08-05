import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { UniversalKPIEngine } from './universal-kpi-engine.service';

export interface ICreateKPIConfigData {
  kpiCode: string;
  entityType: string;
  kpiName: Record<string, string>;
  description: Record<string, string>;
  calculationQuery: string;
  aggregationPeriods: string[];
  dimensions: string[];
  isRealTime?: boolean;
  cacheEnabled?: boolean;
  cacheTTLMinutes?: number;
  retentionDays?: number;
  compressionEnabled?: boolean;
  partitioningStrategy?: string;
  companiesEnabled?: string[];
}

export interface IKPIConfigUpdate {
  kpiName?: Record<string, string>;
  description?: Record<string, string>;
  calculationQuery?: string;
  aggregationPeriods?: string[];
  dimensions?: string[];
  isRealTime?: boolean;
  cacheEnabled?: boolean;
  cacheTTLMinutes?: number;
  retentionDays?: number;
  compressionEnabled?: boolean;
  partitioningStrategy?: string;
  companiesEnabled?: string[];
  isActive?: boolean;
}

@Injectable()
export class KPIManagementService {
  private readonly logger = new Logger(KPIManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kpiEngine: UniversalKPIEngine,
  ) {}

  /**
   * Crear nueva configuración de KPI
   */
  async createKPIConfiguration(data: ICreateKPIConfigData): Promise<{
    id: string;
    kpiCode: string;
    entityType: string;
    kpiName: Record<string, string>;
    isActive: boolean;
    createdAt: Date;
  }> {
    try {
      const kpiConfig = await this.prisma.kPIConfiguration.create({
        data: {
          kpiCode: data.kpiCode,
          entityType: data.entityType,
          kpiName: data.kpiName,
          description: data.description,
          calculationQuery: data.calculationQuery,
          aggregationPeriods: data.aggregationPeriods,
          dimensions: data.dimensions,
          isRealTime: data.isRealTime || false,
          cacheEnabled: data.cacheEnabled !== false,
          cacheTTLMinutes: data.cacheTTLMinutes || 60,
          retentionDays: data.retentionDays || 730,
          compressionEnabled: data.compressionEnabled !== false,
          partitioningStrategy: (data.partitioningStrategy as any) || 'MONTHLY',
          companiesEnabled: data.companiesEnabled,
        },
      });

      this.logger.log(`KPI configuration created: ${data.kpiCode}`);

      return kpiConfig as any;
    } catch (error) {
      this.logger.error(`Error creating KPI configuration: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Actualizar configuración de KPI existente
   */
  async updateKPIConfiguration(
    kpiCode: string,
    data: IKPIConfigUpdate,
  ): Promise<{
    id: string;
    kpiCode: string;
    updatedAt: Date;
  }> {
    try {
      const updated = await this.prisma.kPIConfiguration.update({
        where: { kpiCode },
        data: {
          ...(data as any),
          updatedAt: new Date(),
        },
      });

      this.logger.log(`KPI configuration updated: ${kpiCode}`);

      return updated;
    } catch (error) {
      this.logger.error(`Error updating KPI configuration: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Eliminar configuración de KPI
   */
  async deleteKPIConfiguration(kpiCode: string): Promise<void> {
    try {
      // Primero eliminar todos los valores asociados
      await this.prisma.kPIValue.deleteMany({
        where: { kpiCode },
      });

      // Luego eliminar la configuración
      await this.prisma.kPIConfiguration.delete({
        where: { kpiCode },
      });

      this.logger.log(`KPI configuration deleted: ${kpiCode}`);
    } catch (error) {
      this.logger.error(`Error deleting KPI configuration: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Obtener todas las configuraciones de KPI
   */
  async getKPIConfigurations(filters?: {
    entityType?: string;
    isActive?: boolean;
    isRealTime?: boolean;
  }): Promise<
    Array<{
      id: string;
      kpiCode: string;
      entityType: string;
      kpiName: Record<string, string>;
      isActive: boolean;
      createdAt: Date;
    }>
  > {
    return this.prisma.kPIConfiguration.findMany({
      where: {
        ...(filters?.entityType && { entityType: filters.entityType }),
        ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
        ...(filters?.isRealTime !== undefined && { isRealTime: filters.isRealTime }),
      },
      orderBy: { createdAt: 'desc' },
    }) as any;
  }

  /**
   * Obtener configuración específica de KPI
   */
  async getKPIConfiguration(kpiCode: string): Promise<any> {
    return this.prisma.kPIConfiguration.findUnique({
      where: { kpiCode },
      include: {
        values: {
          take: 10,
          orderBy: { periodDate: 'desc' },
        },
      },
    });
  }

  /**
   * Calcular KPI manualmente
   */
  async calculateKPIManually(
    kpiCode: string,
    companyId: string,
    periodDate: Date,
    periodType: string,
  ): Promise<any> {
    try {
      await this.kpiEngine.calculateKPI(kpiCode, companyId, periodDate, periodType);

      // Retornar el valor calculado
      return this.prisma.kPIValue.findFirst({
        where: {
          kpiCode,
          companyId,
          periodDate,
          periodType: periodType as any,
        },
        orderBy: { calculatedAt: 'desc' },
      });
    } catch (error) {
      this.logger.error(`Error calculating KPI manually: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Obtener valores de KPI
   */
  async getKPIValues(
    kpiCode: string,
    companyId?: string,
    startDate?: Date,
    endDate?: Date,
    periodType?: string,
  ): Promise<any[]> {
    return this.prisma.kPIValue.findMany({
      where: {
        kpiCode,
        ...(companyId && { companyId }),
        ...(startDate &&
          endDate && {
            periodDate: {
              gte: startDate,
              lte: endDate,
            },
          }),
        ...(periodType && { periodType: periodType as any }),
      } as any,
      orderBy: { periodDate: 'asc' },
    });
  }

  /**
   * Obtener estadísticas de KPI
   */
  async getKPIStatistics(kpiCode: string, companyId?: string): Promise<any> {
    const stats = await this.prisma.kPIValue.aggregate({
      where: {
        kpiCode,
        ...(companyId && { companyId }),
      },
      _count: { id: true },
      _avg: { numericValue: true },
      _min: { numericValue: true },
      _max: { numericValue: true },
      _sum: { recordCount: true },
    });

    return {
      totalCalculations: stats._count.id,
      averageValue: stats._avg.numericValue,
      minValue: stats._min.numericValue,
      maxValue: stats._max.numericValue,
      totalRecordsProcessed: stats._sum.recordCount,
    };
  }

  /**
   * Recalcular todos los KPIs para una empresa
   */
  async recalculateCompanyKPIs(companyId: string, date: Date = new Date()): Promise<void> {
    try {
      const activeKPIs = await this.prisma.kPIConfiguration.findMany({
        where: {
          isActive: true,
          OR: [
            { companiesEnabled: null },
            { companiesEnabled: { path: '$', array_contains: [companyId] } as any },
          ],
        },
      });

      const promises = activeKPIs.map(async kpi => {
        // Calcular para diferentes períodos
        const periods = ['DAILY', 'WEEKLY', 'MONTHLY'];

        for (const period of periods) {
          if ((kpi.aggregationPeriods as any).includes(period)) {
            await this.kpiEngine.calculateKPI(kpi.kpiCode, companyId, date, period);
          }
        }
      });

      await Promise.all(promises);
      this.logger.log(`Recalculated KPIs for company: ${companyId}`);
    } catch (error) {
      this.logger.error(`Error recalculating company KPIs: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Limpiar valores antiguos de KPI
   */
  async cleanupOldKPIValues(retentionDays: number = 730): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const deleted = await this.prisma.kPIValue.deleteMany({
        where: {
          periodDate: {
            lt: cutoffDate,
          },
          kpiConfig: {
            retentionDays: {
              lt: retentionDays,
            },
          },
        },
      });

      this.logger.log(`Cleaned up ${deleted.count} old KPI values`);
    } catch (error) {
      this.logger.error(`Error cleaning up old KPI values: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Obtener tendencias de KPI
   */
  async getKPITrends(
    kpiCode: string,
    companyId: string,
    periodType: string,
    periods: number = 12,
  ): Promise<any> {
    const values = await this.prisma.kPIValue.findMany({
      where: {
        kpiCode,
        companyId,
        periodType: periodType as any,
      },
      orderBy: { periodDate: 'desc' },
      take: periods,
    });

    // Calcular tendencia
    if (values.length < 2) {
      return { values, trend: 'insufficient_data' };
    }

    const recent = values.slice(0, Math.ceil(periods / 2));
    const older = values.slice(Math.ceil(periods / 2));

    const recentAvg =
      recent.reduce((sum, v) => sum + (parseFloat(v.numericValue?.toString()) || 0), 0) /
      recent.length;
    const olderAvg =
      older.reduce((sum, v) => sum + (parseFloat(v.numericValue?.toString()) || 0), 0) /
      older.length;

    let trend = 'stable';
    const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (changePercent > 5) trend = 'increasing';
    else if (changePercent < -5) trend = 'decreasing';

    return {
      values: values.reverse(),
      trend,
      changePercent: Math.round(changePercent * 100) / 100,
      recentAverage: Math.round(recentAvg * 100) / 100,
      olderAverage: Math.round(olderAvg * 100) / 100,
    };
  }

  /**
   * Crear KPIs predefinidos para appointments
   */
  async createAppointmentKPIs(): Promise<void> {
    const kpis = [
      {
        kpiCode: 'appointment_conversion_rate',
        entityType: 'appointments',
        kpiName: {
          en: 'Appointment Conversion Rate',
          es: 'Tasa de Conversión de Citas',
        },
        description: {
          en: 'Percentage of appointments that are completed vs confirmed',
          es: 'Porcentaje de citas completadas vs confirmadas',
        },
        calculationQuery: `
          SELECT 
            (COUNT(*) FILTER (WHERE change_type = 'STATUS_CHANGE' AND (after_data->>'status') = 'COMPLETED')::decimal / 
             NULLIF(COUNT(*) FILTER (WHERE change_type = 'STATUS_CHANGE' AND (after_data->>'status') IN ('CONFIRMED', 'COMPLETED')), 0) * 100) as value,
            COUNT(*) as record_count
          FROM universal_audit_log 
          WHERE entity_type = 'appointments' 
            AND event_date >= $1 AND event_date <= $2
            AND company_id = $3
        `,
        aggregationPeriods: ['DAILY', 'WEEKLY', 'MONTHLY'],
        dimensions: ['companyId', 'employeeId', 'eventTypeId'],
        isRealTime: true,
      },
      {
        kpiCode: 'appointment_no_show_rate',
        entityType: 'appointments',
        kpiName: {
          en: 'No Show Rate',
          es: 'Tasa de Inasistencia',
        },
        description: {
          en: 'Percentage of confirmed appointments where client did not show',
          es: 'Porcentaje de citas confirmadas donde el cliente no asistió',
        },
        calculationQuery: `
          SELECT 
            (COUNT(*) FILTER (WHERE change_type = 'STATUS_CHANGE' AND (after_data->>'status') = 'NO_SHOW')::decimal / 
             NULLIF(COUNT(*) FILTER (WHERE change_type = 'STATUS_CHANGE' AND (after_data->>'status') IN ('CONFIRMED', 'COMPLETED', 'NO_SHOW')), 0) * 100) as value,
            COUNT(*) as record_count
          FROM universal_audit_log 
          WHERE entity_type = 'appointments' 
            AND event_date >= $1 AND event_date <= $2
            AND company_id = $3
        `,
        aggregationPeriods: ['DAILY', 'WEEKLY', 'MONTHLY'],
        dimensions: ['companyId', 'employeeId', 'eventTypeId'],
        isRealTime: true,
      },
      {
        kpiCode: 'appointment_avg_duration',
        entityType: 'appointments',
        kpiName: {
          en: 'Average Appointment Duration',
          es: 'Duración Promedio de Citas',
        },
        description: {
          en: 'Average actual duration of completed appointments in minutes',
          es: 'Duración real promedio de citas completadas en minutos',
        },
        calculationQuery: `
          SELECT 
            AVG((after_data->>'actualDuration')::int) as value,
            COUNT(*) as record_count
          FROM universal_audit_log 
          WHERE entity_type = 'appointments' 
            AND change_type = 'STATUS_CHANGE'
            AND (after_data->>'status') = 'COMPLETED'
            AND (after_data->>'actualDuration') IS NOT NULL
            AND event_date >= $1 AND event_date <= $2
            AND company_id = $3
        `,
        aggregationPeriods: ['DAILY', 'WEEKLY', 'MONTHLY'],
        dimensions: ['companyId', 'employeeId', 'eventTypeId'],
        isRealTime: false,
      },
      {
        kpiCode: 'appointment_reschedule_rate',
        entityType: 'appointments',
        kpiName: {
          en: 'Reschedule Rate',
          es: 'Tasa de Reagendamiento',
        },
        description: {
          en: 'Percentage of appointments that are rescheduled',
          es: 'Porcentaje de citas que son reagendadas',
        },
        calculationQuery: `
          SELECT 
            (COUNT(*) FILTER (WHERE change_type = 'STATUS_CHANGE' AND (after_data->>'status') = 'RESCHEDULED')::decimal / 
             NULLIF(COUNT(*) FILTER (WHERE change_type = 'CREATED'), 0) * 100) as value,
            COUNT(*) as record_count
          FROM universal_audit_log 
          WHERE entity_type = 'appointments' 
            AND event_date >= $1 AND event_date <= $2
            AND company_id = $3
        `,
        aggregationPeriods: ['DAILY', 'WEEKLY', 'MONTHLY'],
        dimensions: ['companyId', 'employeeId', 'eventTypeId'],
        isRealTime: true,
      },
    ];

    for (const kpi of kpis) {
      try {
        await this.createKPIConfiguration(kpi);
        this.logger.log(`Created predefined KPI: ${kpi.kpiCode}`);
      } catch (error) {
        if (error.code === 'P2002') {
          this.logger.warn(`KPI already exists: ${kpi.kpiCode}`);
        } else {
          this.logger.error(`Error creating KPI ${kpi.kpiCode}: ${error.message}`);
        }
      }
    }
  }
}
