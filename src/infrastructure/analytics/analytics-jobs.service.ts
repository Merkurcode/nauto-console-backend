import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma/prisma.service';
import { UniversalKPIEngine } from './universal-kpi-engine.service';
import { KPIManagementService } from './kpi-management.service';

@Injectable()
export class AnalyticsJobsService {
  private readonly logger = new Logger(AnalyticsJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kpiEngine: UniversalKPIEngine,
    private readonly kpiManager: KPIManagementService,
  ) {}

  /**
   * Job diario - Ejecuta cada día a las 2:00 AM
   */
  @Cron('0 2 * * *', {
    name: 'daily-analytics-maintenance',
    timeZone: 'America/Mexico_City',
  })
  async dailyMaintenanceJob(): Promise<void> {
    this.logger.log('Starting daily analytics maintenance job');
    const startTime = performance.now();

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // 1. Calcular KPIs diarios del día anterior
      await this.calculateDailyKPIs(yesterday);

      // 2. Archivar registros antiguos (>2 años)
      await this.archiveOldRecords(2, 'years');

      // 3. Limpiar cache expirado
      await this.cleanupExpiredCache();

      // 4. Crear particiones futuras si es necesario
      await this.createFuturePartitions(1); // 1 mes adelante

      // 5. Limpiar eventos del sistema procesados antiguos
      await this.cleanupProcessedSystemEvents();

      const duration = performance.now() - startTime;
      this.logger.log(`Daily maintenance completed in ${Math.round(duration)}ms`);
    } catch (error) {
      this.logger.error(`Daily maintenance job failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Job semanal - Ejecuta cada domingo a las 3:00 AM
   */
  @Cron('0 3 * * 0', {
    name: 'weekly-analytics-optimization',
    timeZone: 'America/Mexico_City',
  })
  async weeklyOptimizationJob(): Promise<void> {
    this.logger.log('Starting weekly analytics optimization job');
    const startTime = performance.now();

    try {
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      // 1. Calcular KPIs semanales de la semana anterior
      await this.calculateWeeklyKPIs(lastWeek);

      // 2. Optimización de consultas lentas
      await this.analyzeSlowQueries();

      // 3. Comprimir particiones antiguas (>3 meses)
      await this.compressOldPartitions(90);

      // 4. Estadísticas de uso de cache
      await this.analyzeCachePerformance();

      // 5. Limpiar valores antiguos de KPI según retención
      await this.kpiManager.cleanupOldKPIValues();

      const duration = performance.now() - startTime;
      this.logger.log(`Weekly optimization completed in ${Math.round(duration)}ms`);
    } catch (error) {
      this.logger.error(`Weekly optimization job failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Job mensual - Ejecuta el primer día del mes a las 4:00 AM
   */
  @Cron('0 4 1 * *', {
    name: 'monthly-analytics-reporting',
    timeZone: 'America/Mexico_City',
  })
  async monthlyReportingJob(): Promise<void> {
    this.logger.log('Starting monthly analytics reporting job');
    const startTime = performance.now();

    try {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      // 1. Calcular KPIs mensuales del mes anterior
      await this.calculateMonthlyKPIs(lastMonth);

      // 2. Generar reportes agregados mensuales
      await this.generateMonthlyReports(lastMonth);

      // 3. Archivar datos muy antiguos (>5 años)
      await this.archiveVeryOldData(5);

      // 4. Análisis de tendencias y alertas
      await this.analyzeTrendsAndAlerts();

      // 5. Crear particiones para próximos 6 meses
      await this.createFuturePartitions(6);

      const duration = performance.now() - startTime;
      this.logger.log(`Monthly reporting completed in ${Math.round(duration)}ms`);
    } catch (error) {
      this.logger.error(`Monthly reporting job failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Job de tiempo real - Ejecuta cada 5 minutos
   */
  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'realtime-kpi-updates',
  })
  async realTimeKPIUpdates(): Promise<void> {
    try {
      // Solo procesar KPIs de tiempo real
      const realTimeKPIs = await this.prisma.kPIConfiguration.findMany({
        where: {
          isRealTime: true,
          isActive: true,
        },
      });

      const activeCompanies = await this.getActiveCompanies();
      const now = new Date();

      // Calcular KPIs en paralelo
      const promises = [];
      for (const kpi of realTimeKPIs) {
        for (const company of activeCompanies) {
          promises.push(this.kpiEngine.calculateKPI(kpi.kpiCode, company.id, now, 'HOURLY'));
        }
      }

      await Promise.allSettled(promises);
      this.logger.debug(`Updated ${promises.length} real-time KPIs`);
    } catch (error) {
      this.logger.warn(`Real-time KPI update failed: ${error.message}`);
    }
  }

  /**
   * Job de limpieza de cache - Ejecuta cada hora
   */
  @Cron(CronExpression.EVERY_HOUR, {
    name: 'cache-cleanup',
  })
  async cacheCleanupJob(): Promise<void> {
    try {
      await this.cleanupExpiredCache();
      this.logger.debug('Cache cleanup completed');
    } catch (error) {
      this.logger.warn(`Cache cleanup failed: ${error.message}`);
    }
  }

  // === MÉTODOS PRIVADOS ===

  private async calculateDailyKPIs(date: Date): Promise<void> {
    try {
      const activeKPIs = await this.prisma.kPIConfiguration.findMany({
        where: {
          isActive: true,
          aggregationPeriods: {
            array_contains: ['DAILY'],
          } as any,
        },
      });

      const companies = await this.getActiveCompanies();

      for (const kpi of activeKPIs) {
        const companyPromises = companies.map(company =>
          this.kpiEngine.calculateKPI(kpi.kpiCode, company.id, date, 'DAILY'),
        );
        await Promise.allSettled(companyPromises);
      }

      this.logger.log(
        `Calculated daily KPIs for ${activeKPIs.length} KPIs across ${companies.length} companies`,
      );
    } catch (error) {
      this.logger.error(`Error calculating daily KPIs: ${error.message}`, error.stack);
    }
  }

  private async calculateWeeklyKPIs(date: Date): Promise<void> {
    try {
      const activeKPIs = await this.prisma.kPIConfiguration.findMany({
        where: {
          isActive: true,
          aggregationPeriods: {
            array_contains: ['WEEKLY'],
          } as any,
        },
      });

      const companies = await this.getActiveCompanies();

      for (const kpi of activeKPIs) {
        const companyPromises = companies.map(company =>
          this.kpiEngine.calculateKPI(kpi.kpiCode, company.id, date, 'WEEKLY'),
        );
        await Promise.allSettled(companyPromises);
      }

      this.logger.log(`Calculated weekly KPIs for ${activeKPIs.length} KPIs`);
    } catch (error) {
      this.logger.error(`Error calculating weekly KPIs: ${error.message}`, error.stack);
    }
  }

  private async calculateMonthlyKPIs(date: Date): Promise<void> {
    try {
      const activeKPIs = await this.prisma.kPIConfiguration.findMany({
        where: {
          isActive: true,
          aggregationPeriods: {
            array_contains: ['MONTHLY'],
          } as any,
        },
      });

      const companies = await this.getActiveCompanies();

      for (const kpi of activeKPIs) {
        const companyPromises = companies.map(company =>
          this.kpiEngine.calculateKPI(kpi.kpiCode, company.id, date, 'MONTHLY'),
        );
        await Promise.allSettled(companyPromises);
      }

      this.logger.log(`Calculated monthly KPIs for ${activeKPIs.length} KPIs`);
    } catch (error) {
      this.logger.error(`Error calculating monthly KPIs: ${error.message}`, error.stack);
    }
  }

  private async archiveOldRecords(
    years: number,
    unit: 'years' | 'months' = 'years',
  ): Promise<void> {
    try {
      const cutoffDate = new Date();
      if (unit === 'years') {
        cutoffDate.setFullYear(cutoffDate.getFullYear() - years);
      } else {
        cutoffDate.setMonth(cutoffDate.getMonth() - years);
      }

      // Archivar registros de auditoría antiguos
      const oldAuditRecords = await this.prisma.universalAuditLog.findMany({
        where: {
          eventDate: {
            lt: cutoffDate,
          },
        },
        take: 1000, // Procesar en lotes
      });

      if (oldAuditRecords.length > 0) {
        // Crear archivos comprimidos
        const archivePromises = oldAuditRecords.map(record =>
          this.prisma.dataArchive.create({
            data: {
              originalTable: 'UniversalAuditLog',
              originalId: record.id,
              companyId: record.companyId,
              archivedData: record,
              archiveReason: 'AGE_BASED',
              originalCreatedAt: record.eventDateTime,
              dataSize: Buffer.byteLength(JSON.stringify(record), 'utf8'),
            },
          }),
        );

        await Promise.all(archivePromises);

        // Eliminar registros originales
        await this.prisma.universalAuditLog.deleteMany({
          where: {
            id: {
              in: oldAuditRecords.map(r => r.id),
            },
          },
        });

        this.logger.log(`Archived ${oldAuditRecords.length} old audit records`);
      }
    } catch (error) {
      this.logger.error(`Error archiving old records: ${error.message}`, error.stack);
    }
  }

  private async cleanupExpiredCache(): Promise<void> {
    try {
      const expired = await this.prisma.queryCache.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      if (expired.count > 0) {
        this.logger.log(`Cleaned up ${expired.count} expired cache entries`);
      }
    } catch (error) {
      this.logger.error(`Error cleaning up cache: ${error.message}`, error.stack);
    }
  }

  private async cleanupProcessedSystemEvents(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30); // Mantener eventos por 30 días

      const deleted = await this.prisma.systemEvent.deleteMany({
        where: {
          isProcessed: true,
          processedAt: {
            lt: cutoffDate,
          },
        },
      });

      if (deleted.count > 0) {
        this.logger.log(`Cleaned up ${deleted.count} processed system events`);
      }
    } catch (error) {
      this.logger.error(`Error cleaning up system events: ${error.message}`, error.stack);
    }
  }

  private async createFuturePartitions(monthsAhead: number): Promise<void> {
    try {
      // Esta función requeriría acceso directo a PostgreSQL para crear particiones
      // Por ahora solo logueamos la operación
      this.logger.log(`Would create partitions for next ${monthsAhead} months`);

      // En una implementación real, ejecutaríamos SQL directo:
      // await this.prisma.$executeRaw`SELECT create_strategic_partitions('universal_audit_log', 'event_date', 'MONTHLY', ${monthsAhead})`;
    } catch (error) {
      this.logger.error(`Error creating future partitions: ${error.message}`, error.stack);
    }
  }

  private async compressOldPartitions(daysOld: number): Promise<void> {
    try {
      this.logger.log(`Would compress partitions older than ${daysOld} days`);
      // Implementación específica de PostgreSQL para compresión
    } catch (error) {
      this.logger.error(`Error compressing old partitions: ${error.message}`, error.stack);
    }
  }

  private async analyzeSlowQueries(): Promise<void> {
    try {
      // Analizar queries lentas y generar recomendaciones
      const slowQueries = await this.prisma.queryCache.findMany({
        where: {
          lastAccessedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Última semana
          },
        },
        orderBy: {
          hitCount: 'desc',
        },
        take: 10,
      });

      this.logger.log(`Analyzed ${slowQueries.length} frequently accessed queries`);
    } catch (error) {
      this.logger.error(`Error analyzing slow queries: ${error.message}`, error.stack);
    }
  }

  private async analyzeCachePerformance(): Promise<void> {
    try {
      const stats = await this.prisma.queryCache.aggregate({
        _count: { id: true },
        _avg: { hitCount: true, resultSize: true },
        _sum: { hitCount: true },
      });

      this.logger.log(
        `Cache performance - Total: ${stats._count.id}, Avg hits: ${stats._avg.hitCount}, Total hits: ${stats._sum.hitCount}`,
      );
    } catch (error) {
      this.logger.error(`Error analyzing cache performance: ${error.message}`, error.stack);
    }
  }

  private async generateMonthlyReports(date: Date): Promise<void> {
    try {
      // Generar reportes agregados por empresa
      const companies = await this.getActiveCompanies();

      for (const company of companies) {
        const monthlyStats = await this.generateCompanyMonthlyStats(company.id, date);

        // Aquí se podría enviar por email, guardar en archivo, etc.
        this.logger.debug(`Generated monthly report for company ${company.id}:`, monthlyStats);
      }
    } catch (error) {
      this.logger.error(`Error generating monthly reports: ${error.message}`, error.stack);
    }
  }

  private async generateCompanyMonthlyStats(
    companyId: string,
    date: Date,
  ): Promise<{
    companyId: string;
    period: string;
    stats: Record<string, Record<string, number>>;
  }> {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const stats = await this.prisma.universalAuditLog.groupBy({
      by: ['entityType', 'changeType'],
      where: {
        companyId,
        eventDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _count: { id: true },
    });

    return {
      companyId,
      period: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      stats: stats.reduce((acc, stat) => {
        if (!acc[stat.entityType]) acc[stat.entityType] = {};
        acc[stat.entityType][stat.changeType] = stat._count.id;

        return acc;
      }, {}),
    };
  }

  private async analyzeTrendsAndAlerts(): Promise<void> {
    try {
      // Analizar tendencias y generar alertas para KPIs críticos
      const criticalKPIs = ['appointment_conversion_rate', 'appointment_no_show_rate'];
      const companies = await this.getActiveCompanies();

      for (const company of companies) {
        for (const kpiCode of criticalKPIs) {
          const trend = await this.kpiManager.getKPITrends(kpiCode, company.id, 'MONTHLY', 6);

          // Generar alerta si hay tendencia negativa significativa
          if (trend.trend === 'decreasing' && Math.abs(trend.changePercent) > 20) {
            await this.createAlert(company.id, kpiCode, trend);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error analyzing trends and alerts: ${error.message}`, error.stack);
    }
  }

  private async createAlert(
    companyId: string,
    kpiCode: string,
    trend: {
      trend: string;
      changePercent: number;
    },
  ): Promise<void> {
    await this.prisma.systemEvent.create({
      data: {
        eventType: 'KPI_THRESHOLD_REACHED',
        entityType: 'kpi_value',
        entityId: kpiCode,
        eventDate: new Date(),
        companyId,
        eventData: {
          kpiCode,
          trend: trend.trend,
          changePercent: trend.changePercent,
          alertLevel: 'WARNING',
        },
        severity: 'WARNING',
      },
    });

    this.logger.warn(
      `Created alert for company ${companyId}: ${kpiCode} trending ${trend.trend} by ${trend.changePercent}%`,
    );
  }

  private async archiveVeryOldData(years: number): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - years);

      // Mover a archivo permanente datos muy antiguos
      const veryOldData = await this.prisma.dataArchive.findMany({
        where: {
          archiveDate: {
            lt: cutoffDate,
          },
        },
        take: 100,
      });

      // En un sistema real, estos se moverían a cold storage (S3 Glacier, etc.)
      this.logger.log(`Would move ${veryOldData.length} records to cold storage`);
    } catch (error) {
      this.logger.error(`Error archiving very old data: ${error.message}`, error.stack);
    }
  }

  private async getActiveCompanies(): Promise<Array<{ id: string; name: string }>> {
    return this.prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });
  }

  /**
   * Método manual para ejecutar mantenimiento inmediato
   */
  async runMaintenanceNow(): Promise<void> {
    this.logger.log('Running manual maintenance job');
    await this.dailyMaintenanceJob();
  }

  /**
   * Método manual para recalcular KPIs de una empresa
   */
  async recalculateCompanyKPIsNow(companyId: string): Promise<void> {
    await this.kpiManager.recalculateCompanyKPIs(companyId);
  }
}
