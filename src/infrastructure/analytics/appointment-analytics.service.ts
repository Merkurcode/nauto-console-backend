import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { UniversalKPIEngine, IComplexQuery, IMetricsResult } from './universal-kpi-engine.service';

export interface IAppointmentCreateData {
  title: string;
  description?: string;
  startDateTime: Date;
  estimatedDuration: number;
  companyId: string;
  employeeId: string;
  clientId?: string;
  eventTypeId: string;
  createdByApp: string;
  companyName: string;
  employeeName: string;
  employeeEmail: string;
  clientName?: string;
  clientEmail?: string;
  eventTypeName: string;
  clientPhone?: string;
  accompaniedCount?: number;
  visibility?: string;
  notes?: string;
  internalNotes?: string;
  clientNotes?: string;
  attachmentUrls?: string[];
  metadata?: Record<string, unknown>;
  supportingEmployees?: Array<{
    employeeId: string;
    name: string;
    role?: string;
  }>;
  reminderSchedule?: Record<string, unknown>;
  createdBy?: string;
}

export interface IAppointmentUpdateData {
  title?: string;
  description?: string;
  status?: string;
  startDateTime?: Date;
  estimatedDuration?: number;
  actualDuration?: number;
  employeeId?: string;
  employeeName?: string;
  employeeEmail?: string;
  notes?: string;
  internalNotes?: string;
  clientNotes?: string;
  cancellationReason?: string;
  lastModifiedBy?: string;
  metadata?: Record<string, unknown>;
}

export interface IAppointmentMetricsQuery {
  companyId?: string;
  employeeId?: string;
  eventTypeId?: string;
  startDate: Date;
  endDate: Date;
  groupBy?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  includeDetails?: boolean;
  filters?: {
    status?: string[];
    createdByApp?: string[];
    visibility?: string[];
    hasNotes?: boolean;
    minDuration?: number;
    maxDuration?: number;
    clientType?: 'new' | 'recurring';
  };
}

@Injectable()
export class AppointmentAnalyticsService {
  private readonly logger = new Logger(AppointmentAnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kpiEngine: UniversalKPIEngine,
  ) {}

  /**
   * Crear nueva cita con auditoría automática
   */
  async createAppointment(
    data: IAppointmentCreateData,
    context: { userId?: string; sessionId?: string; userAgent?: string; ipAddress?: string },
  ): Promise<{
    id: string;
    title: string;
    status: string;
    startDateTime: Date;
    companyId: string;
    employeeId: string;
  }> {
    const startTime = performance.now();

    try {
      // 1. Crear la cita
      const appointment = await this.prisma.appointments.create({
        data: {
          id: this.generateId(),
          title: data.title,
          description: data.description,
          startDateTime: data.startDateTime,
          estimatedDuration: data.estimatedDuration,
          companyId: data.companyId,
          employeeId: data.employeeId,
          clientId: data.clientId,
          eventTypeId: data.eventTypeId,
          companyName: data.companyName,
          employeeName: data.employeeName,
          employeeEmail: data.employeeEmail,
          clientName: data.clientName,
          clientEmail: data.clientEmail,
          eventTypeName: data.eventTypeName,
          createdByApp: data.createdByApp,
          clientPhone: data.clientPhone,
          accompaniedCount: data.accompaniedCount || 0,
          visibility: (data.visibility as any) || 'INTERNAL',
          notes: data.notes,
          internalNotes: data.internalNotes,
          clientNotes: data.clientNotes,
          attachmentUrls: data.attachmentUrls || [],
          metadata: data.metadata as any,
          supportingEmployees: data.supportingEmployees || [],
          reminderSchedule: data.reminderSchedule as any,
          createdBy: data.createdBy || context.userId,
          lastModifiedBy: data.createdBy || context.userId,
        },
      });

      // 2. Crear entrada en historial
      await this.createHistoryEntry(appointment, 'CREATE', null, appointment, context);

      // 3. Procesar auditoría universal
      await this.kpiEngine.processEntityChange(
        'appointments',
        appointment.id,
        'CREATE',
        null,
        appointment,
        {
          companyId: data.companyId,
          userId: context.userId,
          sessionId: context.sessionId,
          applicationSource: data.createdByApp,
          userAgent: context.userAgent,
          ipAddress: context.ipAddress,
          changeReason: 'Appointment created',
          businessContext: {
            eventType: data.eventTypeName,
            employeeName: data.employeeName,
            estimatedDuration: data.estimatedDuration,
          },
        },
      );

      const processingTime = performance.now() - startTime;
      this.logger.debug(`Appointment created in ${processingTime.toFixed(2)}ms`);

      return appointment;
    } catch (error) {
      this.logger.error(`Error creating appointment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Actualizar cita existente con auditoría
   */
  async updateAppointment(
    appointmentId: string,
    data: IAppointmentUpdateData,
    context: {
      userId?: string;
      sessionId?: string;
      userAgent?: string;
      ipAddress?: string;
      changeReason?: string;
    },
  ): Promise<{
    id: string;
    title: string;
    status: string;
    version: number;
    updatedAt: Date;
  }> {
    const startTime = performance.now();

    try {
      // 1. Obtener estado actual
      const currentAppointment = await this.prisma.appointments.findUnique({
        where: { id: appointmentId },
      });

      if (!currentAppointment) {
        throw new Error(`Appointment not found: ${appointmentId}`);
      }

      // 2. Actualizar la cita
      const updatedAppointment = await this.prisma.appointments.update({
        where: { id: appointmentId },
        data: {
          ...(data as any),
          lastModifiedBy: context.userId,
          version: currentAppointment.version + 1,
          updatedAt: new Date(),
          // Timestamps específicos por estado
          ...(data.status === 'CONFIRMED' && { confirmedAt: new Date() }),
          ...(data.status === 'IN_PROGRESS' && { startedAt: new Date() }),
          ...(data.status === 'COMPLETED' && { completedAt: new Date() }),
        },
      });

      // 3. Crear entrada en historial
      await this.createHistoryEntry(
        updatedAppointment,
        'UPDATE',
        currentAppointment,
        updatedAppointment,
        context,
      );

      // 4. Procesar auditoría universal
      await this.kpiEngine.processEntityChange(
        'appointments',
        appointmentId,
        'UPDATE',
        currentAppointment,
        updatedAppointment,
        {
          companyId: currentAppointment.companyId,
          userId: context.userId,
          sessionId: context.sessionId,
          applicationSource: currentAppointment.createdByApp,
          userAgent: context.userAgent,
          ipAddress: context.ipAddress,
          changeReason: context.changeReason || 'Appointment updated',
          businessContext: {
            statusChange: currentAppointment.status !== updatedAppointment.status,
            oldStatus: currentAppointment.status,
            newStatus: updatedAppointment.status,
          },
        },
      );

      const processingTime = performance.now() - startTime;
      this.logger.debug(`Appointment updated in ${processingTime.toFixed(2)}ms`);

      return updatedAppointment;
    } catch (error) {
      this.logger.error(`Error updating appointment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Reagendar cita
   */
  async rescheduleAppointment(
    appointmentId: string,
    newStartDateTime: Date,
    newEmployeeId?: string,
    context?: any,
  ): Promise<any> {
    try {
      const currentAppointment = await this.prisma.appointments.findUnique({
        where: { id: appointmentId },
      });

      if (!currentAppointment) {
        throw new Error(`Appointment not found: ${appointmentId}`);
      }

      // 1. Crear nueva cita (reagendada)
      const newAppointmentData = {
        ...currentAppointment,
        startDateTime: newStartDateTime,
        employeeId: newEmployeeId || currentAppointment.employeeId,
        createdBy: context?.userId,
      };

      const newAppointment = await this.createAppointment(newAppointmentData as any, context);

      // 2. Actualizar cita original como RESCHEDULED
      await this.updateAppointment(
        appointmentId,
        {
          status: 'RESCHEDULED',
          lastModifiedBy: context?.userId,
        },
        {
          ...context,
          changeReason: `Rescheduled to ${newStartDateTime.toISOString()}`,
        },
      );

      // 3. Vincular ambas citas
      await this.prisma.appointments.update({
        where: { id: newAppointment.id },
        data: {
          rescheduledFromId: appointmentId,
          originalEmployeeId: currentAppointment.employeeId,
          originalEmployeeName: currentAppointment.employeeName,
        },
      });

      return newAppointment;
    } catch (error) {
      this.logger.error(`Error rescheduling appointment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Soft delete de cita
   */
  async deleteAppointment(
    appointmentId: string,
    context: { userId?: string; reason?: string; userAgent?: string; ipAddress?: string },
  ): Promise<void> {
    try {
      const currentAppointment = await this.prisma.appointments.findUnique({
        where: { id: appointmentId },
      });

      if (!currentAppointment) {
        throw new Error(`Appointment not found: ${appointmentId}`);
      }

      // Soft delete
      await this.updateAppointment(
        appointmentId,
        {
          status: 'CANCELLED',
          lastModifiedBy: context.userId,
        },
        {
          userId: context.userId,
          userAgent: context.userAgent,
          ipAddress: context.ipAddress,
          changeReason: context.reason || 'Appointment deleted',
        },
      );

      // Marcar como eliminada
      await this.prisma.appointments.update({
        where: { id: appointmentId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: context.userId,
          deletedReason: context.reason,
        },
      });
    } catch (error) {
      this.logger.error(`Error deleting appointment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Obtener métricas de citas
   */
  async getAppointmentMetrics(query: IAppointmentMetricsQuery): Promise<IMetricsResult[]> {
    try {
      const complexQuery: IComplexQuery = {
        companyId: query.companyId,
        employeeId: query.employeeId,
        eventTypeId: query.eventTypeId,
        startDate: query.startDate,
        endDate: query.endDate,
        groupBy: query.groupBy || 'day',
        conditions: this.buildConditionsFromFilters(query.filters),
        metrics: [
          'total_created',
          'total_confirmed',
          'total_cancelled',
          'total_completed',
          'total_no_show',
          'avg_duration',
        ],
      };

      return await this.kpiEngine.calculateComplexMetrics(complexQuery);
    } catch (error) {
      this.logger.error(`Error getting appointment metrics: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Obtener historial de una cita
   */
  async getAppointmentHistory(appointmentId: string): Promise<any[]> {
    return this.prisma.appointmentHistory.findMany({
      where: { appointmentId },
      orderBy: { version: 'asc' },
    });
  }

  /**
   * Obtener citas con filtros avanzados
   */
  async getAppointments(filters: {
    companyId?: string;
    employeeId?: string;
    status?: string[];
    startDate?: Date;
    endDate?: Date;
    includeDeleted?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ appointments: any[]; total: number }> {
    const where = {
      ...(filters.companyId && { companyId: filters.companyId }),
      ...(filters.employeeId && { employeeId: filters.employeeId }),
      ...(filters.status && { status: { in: filters.status as any } }),
      ...(filters.startDate &&
        filters.endDate && {
          startDateTime: {
            gte: filters.startDate,
            lte: filters.endDate,
          },
        }),
      ...(!filters.includeDeleted && { isDeleted: false }),
    };

    const [appointments, total] = await Promise.all([
      this.prisma.appointments.findMany({
        where,
        take: filters.limit || 50,
        skip: filters.offset || 0,
        orderBy: { startDateTime: 'desc' },
      }),
      this.prisma.appointments.count({ where }),
    ]);

    return { appointments, total };
  }

  /**
   * Verificar disponibilidad de empleado
   */
  async checkEmployeeAvailability(
    employeeId: string,
    startDateTime: Date,
    duration: number,
    excludeAppointmentId?: string,
  ): Promise<{ available: boolean; conflicts: any[] }> {
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);

    const conflicts = await this.prisma.appointments.findMany({
      where: {
        employeeId,
        isDeleted: false,
        status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
        ...(excludeAppointmentId && { id: { not: excludeAppointmentId } }),
        OR: [
          {
            AND: [
              { startDateTime: { lte: startDateTime } },
              {
                startDateTime: {
                  gte: new Date(startDateTime.getTime() - 24 * 60 * 60 * 1000), // Check within same day
                },
              },
            ],
          },
        ],
      },
    });

    // Check for actual time conflicts
    const actualConflicts = conflicts.filter(appointment => {
      const appointmentEnd = new Date(
        appointment.startDateTime.getTime() + appointment.estimatedDuration * 60 * 1000,
      );

      return (
        (startDateTime >= appointment.startDateTime && startDateTime < appointmentEnd) ||
        (endDateTime > appointment.startDateTime && endDateTime <= appointmentEnd) ||
        (startDateTime <= appointment.startDateTime && endDateTime >= appointmentEnd)
      );
    });

    return {
      available: actualConflicts.length === 0,
      conflicts: actualConflicts,
    };
  }

  // === MÉTODOS PRIVADOS ===

  private async createHistoryEntry(
    appointment: any,
    changeType: string,
    beforeData: any,
    afterData: any,
    context: any,
  ): Promise<void> {
    await this.prisma.appointmentHistory.create({
      data: {
        appointmentId: appointment.id,
        // Copiar todos los campos del appointment
        title: afterData.title,
        description: afterData.description,
        status: afterData.status,
        startDateTime: afterData.startDateTime,
        estimatedDuration: afterData.estimatedDuration,
        actualDuration: afterData.actualDuration,
        companyId: afterData.companyId,
        employeeId: afterData.employeeId,
        clientId: afterData.clientId,
        eventTypeId: afterData.eventTypeId,
        companyName: afterData.companyName,
        employeeName: afterData.employeeName,
        employeeEmail: afterData.employeeEmail,
        clientName: afterData.clientName,
        clientEmail: afterData.clientEmail,
        eventTypeName: afterData.eventTypeName,
        createdByApp: afterData.createdByApp,
        externalId: afterData.externalId,
        clientPhone: afterData.clientPhone,
        accompaniedCount: afterData.accompaniedCount,
        visibility: afterData.visibility,
        notes: afterData.notes,
        internalNotes: afterData.internalNotes,
        clientNotes: afterData.clientNotes,
        attachmentUrls: afterData.attachmentUrls,
        metadata: afterData.metadata,
        originalEmployeeId: afterData.originalEmployeeId,
        originalEmployeeName: afterData.originalEmployeeName,
        rescheduledFromId: afterData.rescheduledFromId,
        cancellationReason: afterData.cancellationReason,
        supportingEmployees: afterData.supportingEmployees,
        reminderEvents: afterData.reminderEvents,
        reminderSchedule: afterData.reminderSchedule,
        // Metadatos del cambio
        changeType,
        changedFields: this.calculateChangedFields(beforeData, afterData),
        previousValues: beforeData ? this.extractChangedValues(beforeData, afterData) : null,
        changeReason: context.changeReason,
        version: afterData.version,
        createdBy: context.userId,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
      },
    });
  }

  private calculateChangedFields(beforeData: any, afterData: any): string[] {
    if (!beforeData) return Object.keys(afterData);

    const changed = [];
    for (const key in afterData) {
      if (beforeData[key] !== afterData[key]) {
        changed.push(key);
      }
    }

    return changed;
  }

  private extractChangedValues(beforeData: any, afterData: any): Record<string, any> {
    if (!beforeData) return {};

    const changed = {};
    for (const key in afterData) {
      if (beforeData[key] !== afterData[key]) {
        changed[key] = beforeData[key];
      }
    }

    return changed;
  }

  private buildConditionsFromFilters(filters?: any): any[] {
    if (!filters) return [];

    const conditions = [];

    if (filters.status) {
      conditions.push({
        field: "(after_data->>'status')",
        operator: 'IN',
        value: filters.status,
      });
    }

    if (filters.createdByApp) {
      conditions.push({
        field: 'application_source',
        operator: 'IN',
        value: filters.createdByApp,
      });
    }

    if (filters.minDuration) {
      conditions.push({
        field: "(after_data->>'estimatedDuration')::int",
        operator: '>=',
        value: filters.minDuration,
      });
    }

    if (filters.maxDuration) {
      conditions.push({
        field: "(after_data->>'estimatedDuration')::int",
        operator: '<=',
        value: filters.maxDuration,
      });
    }

    if (filters.hasNotes !== undefined) {
      if (filters.hasNotes) {
        conditions.push({
          field: "(after_data->>'notes')",
          operator: '!=',
          value: null,
        });
      } else {
        conditions.push({
          field: "(after_data->>'notes')",
          operator: '=',
          value: null,
        });
      }
    }

    return conditions;
  }

  private generateId(): string {
    return `apt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}
