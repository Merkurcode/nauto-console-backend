import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { createHash } from 'crypto';

// Interfaces principales
export interface IComplexQuery {
  companyId?: string;
  employeeId?: string;
  eventTypeId?: string;
  createdByApp?: string;
  startDate: Date;
  endDate: Date;
  groupBy?: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'hour';
  includeHourly?: boolean;
  conditions?: IQueryCondition[];
  metrics?: string[];
  customFilters?: Record<string, unknown>;
}

export interface IQueryCondition {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'IN' | 'NOT IN' | 'LIKE' | 'ILIKE';
  value: unknown;
}

export interface IMetricsResult {
  period: string;
  totalCreated: number;
  totalConfirmed: number;
  totalCancelled: number;
  totalRescheduled: number;
  totalCompleted: number;
  totalNoShow: number;
  confirmationRate: number;
  completionRate: number;
  noShowRate: number;
  rescheduleRate: number;
  avgResponseTime?: number;
  metadata?: Record<string, unknown>;
}

export interface IAuditContext {
  companyId: string;
  userId?: string;
  sessionId?: string;
  applicationSource: string;
  userAgent?: string;
  ipAddress?: string;
  apiEndpoint?: string;
  changeReason?: string;
  businessContext?: Record<string, unknown>;
}

@Injectable()
export class UniversalKPIEngine {
  private readonly logger = new Logger(UniversalKPIEngine.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Procesar cambio en cualquier entidad
   */
  async processEntityChange(
    entityType: string,
    entityId: string,
    operation: string,
    beforeData: Record<string, unknown> | null,
    afterData: Record<string, unknown>,
    context: IAuditContext,
  ): Promise<void> {
    const startTime = performance.now();

    try {
      // 1. Crear registro de auditoría universal
      await this.createAuditRecord({
        entityType,
        entityId,
        operation,
        beforeData,
        afterData,
        ...context,
      });

      // 2. Disparar evento del sistema
      await this.emitSystemEvent({
        eventType: 'ENTITY_CHANGED',
        entityType,
        entityId,
        companyId: context.companyId,
        userId: context.userId,
        eventData: {
          operation,
          changes: this.calculateChanges(beforeData, afterData),
        },
      });

      // 3. Actualizar KPIs en tiempo real (si están configurados)
      if (this.shouldUpdateRealTimeKPIs(entityType)) {
        await this.updateRealTimeKPIs(entityType, context.companyId);
      }

      const processingTime = performance.now() - startTime;
      this.logger.debug(`Entity change processed in ${processingTime.toFixed(2)}ms`);
    } catch (error) {
      this.logger.error(`Error processing entity change: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Calcular métricas complejas con múltiples condiciones
   */
  async calculateComplexMetrics(query: IComplexQuery): Promise<IMetricsResult[]> {
    const startTime = performance.now();

    try {
      // 1. Verificar cache primero (< 50ms)
      const cacheKey = this.generateCacheKey(query);
      const cached = await this.checkCache(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit: ${performance.now() - startTime}ms`);

        return cached;
      }

      // 2. Usar agregados pre-calculados si es posible (< 200ms)
      if (this.canUsePreCalculated(query)) {
        const result = await this.queryPreCalculated(query);
        this.logger.debug(`Pre-calculated: ${performance.now() - startTime}ms`);

        return result;
      }

      // 3. Consulta optimizada con particiones (< 2000ms)
      const result = await this.queryWithPartitionPruning(query);
      this.logger.debug(`Partition query: ${performance.now() - startTime}ms`);

      // 4. Guardar en cache para consultas futuras
      await this.saveToCache(cacheKey, result, query);

      return result;
    } catch (error) {
      this.logger.error(`Error calculating complex metrics: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Calcular KPI específico
   */
  async calculateKPI(
    kpiCode: string,
    companyId: string,
    periodDate: Date,
    periodType: string,
  ): Promise<void> {
    try {
      const kpiConfig = await this.getKPIConfig(kpiCode);
      if (!kpiConfig) {
        throw new Error(`KPI configuration not found: ${kpiCode}`);
      }

      // Ejecutar query personalizada con parámetros
      const result = await this.executeKPIQuery(kpiConfig.calculationQuery, {
        companyId,
        periodDate,
        periodType,
      });

      // Guardar resultado
      await this.saveKPIValue({
        kpiConfigId: kpiConfig.id,
        kpiCode,
        companyId,
        periodDate,
        periodType,
        numericValue: result.value,
        recordCount: result.recordCount,
        metadata: result.metadata,
        calculationTimeMs: result.executionTime,
      });

      this.logger.debug(`KPI ${kpiCode} calculated for ${companyId} - ${periodType}`);
    } catch (error) {
      this.logger.error(`Error calculating KPI ${kpiCode}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Crear registro de auditoría universal
   */
  private async createAuditRecord(data: {
    entityType: string;
    entityId: string;
    operation: string;
    beforeData: Record<string, unknown> | null;
    afterData: Record<string, unknown>;
    companyId: string;
    userId?: string;
    sessionId?: string;
    applicationSource: string;
    userAgent?: string;
    ipAddress?: string;
    apiEndpoint?: string;
    changeReason?: string;
    businessContext?: Record<string, unknown>;
  }): Promise<void> {
    const eventDate = new Date();

    await this.prisma.universalAuditLog.create({
      data: {
        entityType: data.entityType,
        entityId: data.entityId,
        entityTable: this.getTableName(data.entityType),
        eventDate,
        eventDateTime: eventDate,
        eventMonth: eventDate.getMonth() + 1,
        eventYear: eventDate.getFullYear(),
        eventHour: eventDate.getHours(),
        eventDayOfWeek: eventDate.getDay(),
        eventWeekOfYear: this.getWeekOfYear(eventDate),
        eventQuarter: Math.ceil((eventDate.getMonth() + 1) / 3),
        companyId: data.companyId,
        userId: data.userId,
        sessionId: data.sessionId,
        operation: data.operation as any,
        changeType: this.inferChangeType(data.operation, data.beforeData, data.afterData) as any,
        beforeData: data.beforeData as any,
        afterData: data.afterData as any,
        changedFields: this.calculateChangedFields(data.beforeData, data.afterData),
        applicationSource: data.applicationSource,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
        apiEndpoint: data.apiEndpoint,
        changeReason: data.changeReason,
        businessContext: data.businessContext as any,
        impactScore: this.calculateImpactScore(data.entityType, data.operation, data.afterData),
        processingTimeMs: 0,
      },
    });
  }

  /**
   * Emitir evento del sistema
   */
  private async emitSystemEvent(eventData: {
    eventType: string;
    entityType: string;
    entityId: string;
    companyId: string;
    userId?: string;
    eventData: Record<string, unknown>;
    severity?: string;
  }): Promise<void> {
    const eventDate = new Date();

    await this.prisma.systemEvent.create({
      data: {
        eventType: eventData.eventType,
        entityType: eventData.entityType,
        entityId: eventData.entityId,
        eventDate,
        eventDateTime: eventDate,
        companyId: eventData.companyId,
        userId: eventData.userId,
        eventData: eventData.eventData as any,
        severity: (eventData.severity as any) || 'INFO',
      },
    });
  }

  /**
   * Consulta con poda de particiones automática
   */
  private async queryWithPartitionPruning(query: IComplexQuery): Promise<IMetricsResult[]> {
    // 1. Determinar particiones necesarias automáticamente
    const relevantPartitions = this.calculateRelevantPartitions(query.startDate, query.endDate);

    // 2. Construir SQL optimizada
    const sql = this.buildOptimizedQuery(query, relevantPartitions);

    // 3. Ejecutar consulta
    const rawResults = await this.prisma.$queryRawUnsafe(sql) as Array<Record<string, unknown>>;

    // 4. Procesar y formatear resultados
    return this.formatQueryResults(rawResults, query);
  }

  /**
   * Construir query SQL optimizada
   */
  private buildOptimizedQuery(query: IComplexQuery, _partitions: string[]): string {
    const conditions = this.buildWhereConditions(query);
    const groupByClause = this.buildGroupByClause(query.groupBy);
    const selectClause = this.buildSelectClause(query.metrics);

    return `
      WITH filtered_events AS (
        SELECT *
        FROM universal_audit_log 
        WHERE event_date >= '${query.startDate.toISOString().split('T')[0]}' 
          AND event_date <= '${query.endDate.toISOString().split('T')[0]}'
          ${conditions}
      ),
      aggregated_metrics AS (
        ${selectClause}
        FROM filtered_events
        ${groupByClause}
      )
      SELECT * FROM aggregated_metrics
      ORDER BY period;
    `;
  }

  /**
   * Construir condiciones WHERE dinámicamente
   */
  private buildWhereConditions(query: IComplexQuery): string {
    const conditions = [];

    if (query.companyId) {
      conditions.push(`AND company_id = '${query.companyId}'`);
    }

    if (query.employeeId) {
      conditions.push(`AND (after_data->>'employeeId') = '${query.employeeId}'`);
    }

    if (query.eventTypeId) {
      conditions.push(`AND (after_data->>'eventTypeId') = '${query.eventTypeId}'`);
    }

    if (query.createdByApp) {
      conditions.push(`AND application_source = '${query.createdByApp}'`);
    }

    // Condiciones personalizadas
    if (query.conditions) {
      query.conditions.forEach(condition => {
        conditions.push(this.buildCondition(condition));
      });
    }

    return conditions.join(' ');
  }

  /**
   * Generar clave de cache
   */
  private generateCacheKey(query: IComplexQuery): string {
    const queryString = JSON.stringify(query, Object.keys(query).sort());

    return createHash('md5').update(queryString).digest('hex');
  }

  /**
   * Verificar cache
   */
  private async checkCache(cacheKey: string): Promise<IMetricsResult[] | null> {
    try {
      const cached = await this.prisma.queryCache.findUnique({
        where: { queryHash: cacheKey },
      });

      if (cached && cached.expiresAt > new Date()) {
        // Actualizar estadísticas de acceso
        await this.prisma.queryCache.update({
          where: { id: cached.id },
          data: {
            hitCount: cached.hitCount + 1,
            lastAccessedAt: new Date(),
          },
        });

        return cached.resultData as unknown as IMetricsResult[];
      }

      return null;
    } catch (error) {
      this.logger.warn(`Cache check failed: ${error.message}`);

      return null;
    }
  }

  /**
   * Guardar en cache
   */
  private async saveToCache(
    cacheKey: string,
    result: IMetricsResult[],
    query: IComplexQuery,
  ): Promise<void> {
    try {
      const resultJson = JSON.stringify(result);
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 60); // 1 hora TTL

      await this.prisma.queryCache.upsert({
        where: { queryHash: cacheKey },
        create: {
          queryHash: cacheKey,
          companyId: query.companyId,
          entityType: 'appointments', // Por defecto
          queryParams: query as any,
          resultData: result as any,
          resultSize: Buffer.byteLength(resultJson, 'utf8'),
          expiresAt,
        },
        update: {
          resultData: result as any,
          resultSize: Buffer.byteLength(resultJson, 'utf8'),
          calculatedAt: new Date(),
          expiresAt,
          hitCount: 0, // Reset hit count
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to save cache: ${error.message}`);
    }
  }

  // === MÉTODOS HELPER ===

  private shouldUpdateRealTimeKPIs(entityType: string): boolean {
    // Configuración por tipo de entidad
    const realTimeEntities = ['appointments', 'chat_messages'];

    return realTimeEntities.includes(entityType);
  }

  private calculateChanges(
    beforeData: Record<string, unknown> | null,
    afterData: Record<string, unknown> | null,
  ): {
    type?: string;
    changes?: string[];
    [key: string]:
      | {
          from: unknown;
          to: unknown;
        }
      | string
      | string[]
      | undefined;
  } {
    if (!beforeData) return { type: 'created', changes: Object.keys(afterData || {}) };

    const changes = {};
    const allKeys = new Set([...Object.keys(beforeData), ...Object.keys(afterData || {})]);

    for (const key of allKeys) {
      if (beforeData[key] !== afterData?.[key]) {
        changes[key] = {
          from: beforeData[key],
          to: afterData?.[key],
        };
      }
    }

    return changes;
  }

  private calculateChangedFields(
    beforeData: Record<string, unknown> | null,
    afterData: Record<string, unknown> | null,
  ): string[] {
    if (!beforeData) return Object.keys(afterData || {});

    const changedFields = [];
    const allKeys = new Set([...Object.keys(beforeData), ...Object.keys(afterData || {})]);

    for (const key of allKeys) {
      if (beforeData[key] !== afterData?.[key]) {
        changedFields.push(key);
      }
    }

    return changedFields;
  }

  private getTableName(entityType: string): string {
    const tableMap = {
      appointments: 'Appointments',
      chat_messages: 'ChatMessages',
      users: 'User',
      companies: 'Company',
    };

    return tableMap[entityType] || entityType;
  }

  private getWeekOfYear(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;

    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  private inferChangeType(operation: string, beforeData: any, afterData: any): string {
    if (operation === 'CREATE') return 'CREATED';
    if (operation === 'DELETE') return 'DELETED';

    // Para UPDATE, inferir tipo específico
    if (beforeData?.status !== afterData?.status) {
      return 'STATUS_CHANGE';
    }

    return 'UPDATED';
  }

  private calculateImpactScore(
    entityType: string,
    operation: string,
    data: Record<string, unknown>,
  ): number {
    // Algoritmo simple de scoring de impacto (1-100)
    let score = 10; // Base score

    if (operation === 'CREATE') score += 20;
    if (operation === 'DELETE') score += 30;
    if (operation === 'STATUS_CHANGE') score += 25;

    // Factores específicos por entidad
    if (entityType === 'appointments') {
      if (data?.status === 'COMPLETED') score += 15;
      if (data?.status === 'CANCELLED') score += 20;
    }

    return Math.min(score, 100);
  }

  private calculateRelevantPartitions(startDate: Date, endDate: Date): string[] {
    const partitions = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const partitionName = `audit_log_${currentDate.getFullYear()}_${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      partitions.push(partitionName);
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return partitions;
  }

  private canUsePreCalculated(query: IComplexQuery): boolean {
    // Lógica para determinar si puede usar agregados pre-calculados
    const rangeDays = (query.endDate.getTime() - query.startDate.getTime()) / (1000 * 60 * 60 * 24);

    return rangeDays >= 30 && !query.customFilters && !query.conditions;
  }

  private async queryPreCalculated(query: IComplexQuery): Promise<IMetricsResult[]> {
    // Implementar consulta a KPIValue pre-calculados
    const results = await this.prisma.kPIValue.findMany({
      where: {
        companyId: query.companyId,
        periodDate: {
          gte: query.startDate,
          lte: query.endDate,
        },
        periodType: this.mapGroupByToPeriodType(query.groupBy) as any,
      },
      orderBy: { periodDate: 'asc' },
    });

    return this.formatPreCalculatedResults(results as any);
  }

  private mapGroupByToPeriodType(groupBy?: string): string {
    const mapping = {
      hour: 'HOURLY',
      day: 'DAILY',
      week: 'WEEKLY',
      month: 'MONTHLY',
      quarter: 'QUARTERLY',
      year: 'YEARLY',
    };

    return mapping[groupBy] || 'DAILY';
  }

  private buildGroupByClause(groupBy?: string): string {
    const groupByMap = {
      hour: "DATE_TRUNC('hour', event_date_time)",
      day: "DATE_TRUNC('day', event_date)",
      week: "DATE_TRUNC('week', event_date)",
      month: "DATE_TRUNC('month', event_date)",
      quarter: "DATE_TRUNC('quarter', event_date)",
      year: "DATE_TRUNC('year', event_date)",
    };

    const groupByExpr = groupByMap[groupBy] || groupByMap['day'];

    return `GROUP BY ${groupByExpr} as period`;
  }

  private buildSelectClause(_metrics?: string[]): string {
    const defaultMetrics = [
      "COUNT(*) FILTER (WHERE change_type = 'CREATED') as total_created",
      "COUNT(*) FILTER (WHERE change_type = 'STATUS_CHANGE' AND (after_data->>'status') = 'CONFIRMED') as total_confirmed",
      "COUNT(*) FILTER (WHERE change_type = 'STATUS_CHANGE' AND (after_data->>'status') = 'CANCELLED') as total_cancelled",
      "COUNT(*) FILTER (WHERE change_type = 'STATUS_CHANGE' AND (after_data->>'status') = 'COMPLETED') as total_completed",
      "COUNT(*) FILTER (WHERE change_type = 'STATUS_CHANGE' AND (after_data->>'status') = 'NO_SHOW') as total_no_show",
    ];

    return `SELECT ${defaultMetrics.join(', ')}`;
  }

  private buildCondition(condition: IQueryCondition): string {
    const { field, operator, value } = condition;

    switch (operator) {
      case '=':
        return `AND ${field} = '${value}'`;
      case '!=':
        return `AND ${field} != '${value}'`;
      case '>':
        return `AND ${field} > '${value}'`;
      case '<':
        return `AND ${field} < '${value}'`;
      case '>=':
        return `AND ${field} >= '${value}'`;
      case '<=':
        return `AND ${field} <= '${value}'`;
      case 'IN':
        const inValues = Array.isArray(value) ? value.map(v => `'${v}'`).join(',') : `'${value}'`;

        return `AND ${field} IN (${inValues})`;
      case 'LIKE':
        return `AND ${field} LIKE '%${value}%'`;
      case 'ILIKE':
        return `AND ${field} ILIKE '%${value}%'`;
      default:
        return '';
    }
  }

  private formatQueryResults(
    rawResults: Array<Record<string, unknown>>,
    _query: IComplexQuery,
  ): IMetricsResult[] {
    return rawResults.map(row => ({
      period: String(row.period || ''),
      totalCreated: parseInt(String(row.total_created || 0)) || 0,
      totalConfirmed: parseInt(String(row.total_confirmed || 0)) || 0,
      totalCancelled: parseInt(String(row.total_cancelled || 0)) || 0,
      totalRescheduled: parseInt(String(row.total_rescheduled || 0)) || 0,
      totalCompleted: parseInt(String(row.total_completed || 0)) || 0,
      totalNoShow: parseInt(String(row.total_no_show || 0)) || 0,
      confirmationRate: this.calculateRate(Number(row.total_confirmed || 0), Number(row.total_created || 0)),
      completionRate: this.calculateRate(Number(row.total_completed || 0), Number(row.total_confirmed || 0)),
      noShowRate: this.calculateRate(Number(row.total_no_show || 0), Number(row.total_confirmed || 0)),
      rescheduleRate: this.calculateRate(Number(row.total_rescheduled || 0), Number(row.total_created || 0)),
      metadata: {
        queryExecutionTime: row.execution_time,
        partitionsQueried: row.partitions_count,
      },
    }));
  }

  private formatPreCalculatedResults(
    results: Array<{
      periodDate: Date;
      numericValue?: number;
      jsonValue?: Record<string, unknown>;
      calculatedAt?: Date;
      recordCount?: number;
    }>,
  ): IMetricsResult[] {
    return results.map((row: any) => ({
      period: row.periodDate.toISOString(),
      totalCreated: row.jsonValue?.totalCreated || 0,
      totalConfirmed: row.jsonValue?.totalConfirmed || 0,
      totalCancelled: row.jsonValue?.totalCancelled || 0,
      totalRescheduled: row.jsonValue?.totalRescheduled || 0,
      totalCompleted: row.jsonValue?.totalCompleted || 0,
      totalNoShow: row.jsonValue?.totalNoShow || 0,
      confirmationRate: parseFloat(row.numericValue?.toString()) || 0,
      completionRate: row.jsonValue?.completionRate || 0,
      noShowRate: row.jsonValue?.noShowRate || 0,
      rescheduleRate: row.jsonValue?.rescheduleRate || 0,
      metadata: {
        source: 'pre-calculated',
        calculatedAt: row.calculatedAt,
        recordCount: row.recordCount,
      },
    }));
  }

  private calculateRate(numerator: number, denominator: number): number {
    if (!denominator || denominator === 0) return 0;

    return Math.round((numerator / denominator) * 100 * 100) / 100; // Round to 2 decimals
  }

  private async getKPIConfig(kpiCode: string): Promise<{
    id: string;
    kpiCode: string;
    calculationQuery: string;
  } | null> {
    return this.prisma.kPIConfiguration.findUnique({
      where: { kpiCode },
    });
  }

  private async executeKPIQuery(
    query: string,
    params: Record<string, unknown>,
  ): Promise<{
    value: number;
    recordCount: number;
    executionTime: number;
    metadata: Record<string, unknown>;
  }> {
    const startTime = performance.now();

    // Ejecutar query personalizada
    const result = await this.prisma.$queryRawUnsafe(query) as Array<Record<string, unknown>>;

    const executionTime = performance.now() - startTime;

    return {
      value: Number(result[0]?.value || 0),
      recordCount: Number(result[0]?.record_count || 0),
      executionTime: Math.round(executionTime),
      metadata: {
        params,
        executedAt: new Date(),
      },
    };
  }

  private async saveKPIValue(data: {
    kpiConfigId: string;
    kpiCode: string;
    companyId: string;
    periodDate: Date;
    periodType: string;
    numericValue: number;
    recordCount: number;
    metadata?: Record<string, unknown>;
    calculationTimeMs: number;
    dimensionValues?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.kPIValue.upsert({
      where: {
        kpiConfigId_periodDate_periodType_companyId_dimensionValues: {
          kpiConfigId: data.kpiConfigId,
          periodDate: data.periodDate,
          periodType: data.periodType as any,
          companyId: data.companyId,
          dimensionValues: (data.dimensionValues || {}) as any,
        },
      },
      create: {
        ...(data as any),
        periodYear: data.periodDate.getFullYear(),
        periodMonth: data.periodDate.getMonth() + 1,
        periodDay: data.periodDate.getDate(),
        periodHour: data.periodDate.getHours(),
        dimensionValues: (data.dimensionValues || {}) as any,
      },
      update: {
        numericValue: data.numericValue,
        recordCount: data.recordCount,
        calculatedAt: new Date(),
        calculationTimeMs: data.calculationTimeMs,
        metadata: data.metadata as any,
      },
    });
  }

  private async updateRealTimeKPIs(entityType: string, companyId: string): Promise<void> {
    // Actualizar KPIs configurados para tiempo real
    const realTimeKPIs = await this.prisma.kPIConfiguration.findMany({
      where: {
        entityType,
        isRealTime: true,
        isActive: true,
      },
    });

    for (const kpi of realTimeKPIs) {
      await this.calculateKPI(kpi.kpiCode, companyId, new Date(), 'DAILY');
    }
  }
}
