import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import {
  UniversalKPIEngine,
  IComplexQuery,
} from '../../../infrastructure/analytics/universal-kpi-engine.service';
import {
  AppointmentAnalyticsService,
  IAppointmentCreateData,
  IAppointmentUpdateData,
  IAppointmentMetricsQuery,
} from '../../../infrastructure/analytics/appointment-analytics.service';
import {
  KPIManagementService,
  ICreateKPIConfigData,
  IKPIConfigUpdate,
} from '../../../infrastructure/analytics/kpi-management.service';
import { AnalyticsJobsService } from '../../../infrastructure/analytics/analytics-jobs.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly kpiEngine: UniversalKPIEngine,
    private readonly appointmentAnalytics: AppointmentAnalyticsService,
    private readonly kpiManager: KPIManagementService,
    private readonly analyticsJobs: AnalyticsJobsService,
  ) {}

  // === ENDPOINTS DE CITAS ===

  @Post('appointments')
  @ApiOperation({ summary: 'Create new appointment with automatic auditing' })
  @ApiResponse({ status: 201, description: 'Appointment created successfully' })
  async createAppointment(
    @Body() createData: IAppointmentCreateData,
    @Query('userId') userId?: string,
  ) {
    const context = {
      userId,
      sessionId: 'session-123', // En implementación real vendría del JWT
      userAgent: 'web-app',
      ipAddress: '192.168.1.1', // En implementación real vendría del request
    };

    return this.appointmentAnalytics.createAppointment(createData, context);
  }

  @Put('appointments/:id')
  @ApiOperation({ summary: 'Update appointment with automatic auditing' })
  async updateAppointment(
    @Param('id') appointmentId: string,
    @Body() updateData: IAppointmentUpdateData,
    @Query('userId') userId?: string,
    @Query('reason') changeReason?: string,
  ) {
    const context = {
      userId,
      sessionId: 'session-123',
      userAgent: 'web-app',
      ipAddress: '192.168.1.1',
      changeReason,
    };

    return this.appointmentAnalytics.updateAppointment(appointmentId, updateData, context);
  }

  @Post('appointments/:id/reschedule')
  @ApiOperation({ summary: 'Reschedule appointment' })
  async rescheduleAppointment(
    @Param('id') appointmentId: string,
    @Body() rescheduleData: { newStartDateTime: string; newEmployeeId?: string },
    @Query('userId') userId?: string,
  ) {
    const context = {
      userId,
      sessionId: 'session-123',
      userAgent: 'web-app',
      ipAddress: '192.168.1.1',
    };

    return this.appointmentAnalytics.rescheduleAppointment(
      appointmentId,
      new Date(rescheduleData.newStartDateTime),
      rescheduleData.newEmployeeId,
      context,
    );
  }

  @Delete('appointments/:id')
  @ApiOperation({ summary: 'Soft delete appointment' })
  async deleteAppointment(
    @Param('id') appointmentId: string,
    @Query('userId') userId?: string,
    @Query('reason') reason?: string,
  ) {
    const context = {
      userId,
      reason,
      userAgent: 'web-app',
      ipAddress: '192.168.1.1',
    };

    return this.appointmentAnalytics.deleteAppointment(appointmentId, context);
  }

  @Get('appointments')
  @ApiOperation({ summary: 'Get appointments with advanced filters' })
  async getAppointments(
    @Query('companyId') companyId?: string,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('includeDeleted') includeDeleted?: boolean,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const filters = {
      companyId,
      employeeId,
      status: status ? status.split(',') : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      includeDeleted: includeDeleted === true,
      limit: limit ? parseInt(limit.toString()) : undefined,
      offset: offset ? parseInt(offset.toString()) : undefined,
    };

    return this.appointmentAnalytics.getAppointments(filters);
  }

  @Get('appointments/:id/history')
  @ApiOperation({ summary: 'Get complete appointment history' })
  async getAppointmentHistory(@Param('id') appointmentId: string) {
    return this.appointmentAnalytics.getAppointmentHistory(appointmentId);
  }

  @Get('appointments/:id/availability')
  @ApiOperation({ summary: 'Check employee availability for appointment time' })
  async checkEmployeeAvailability(
    @Query('employeeId') employeeId: string,
    @Query('startDateTime') startDateTime: string,
    @Query('duration') duration: number,
    @Query('excludeAppointmentId') excludeAppointmentId?: string,
  ) {
    return this.appointmentAnalytics.checkEmployeeAvailability(
      employeeId,
      new Date(startDateTime),
      parseInt(duration.toString()),
      excludeAppointmentId,
    );
  }

  // === ENDPOINTS DE MÉTRICAS ===

  @Post('metrics/appointments')
  @ApiOperation({ summary: 'Get appointment metrics with flexible date ranges and filters' })
  async getAppointmentMetrics(@Body() query: IAppointmentMetricsQuery) {
    return this.appointmentAnalytics.getAppointmentMetrics({
      ...query,
      startDate: new Date(query.startDate),
      endDate: new Date(query.endDate),
    });
  }

  @Post('metrics/complex')
  @ApiOperation({ summary: 'Execute complex metrics query with multiple conditions' })
  async executeComplexQuery(@Body() query: IComplexQuery) {
    return this.kpiEngine.calculateComplexMetrics({
      ...query,
      startDate: new Date(query.startDate),
      endDate: new Date(query.endDate),
    });
  }

  @Get('metrics/dashboard/:companyId')
  @ApiOperation({ summary: 'Get dashboard metrics for company' })
  async getDashboardMetrics(
    @Param('companyId') companyId: string,
    @Query('period') period: string = 'last30days',
  ) {
    const endDate = new Date();
    let startDate = new Date();

    switch (period) {
      case 'today':
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        break;
      case 'last7days':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'last30days':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case 'last90days':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case 'thisMonth':
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        break;
      case 'lastMonth':
        startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1);
        endDate.setDate(0); // Último día del mes anterior
        break;
    }

    const query: IComplexQuery = {
      companyId,
      startDate,
      endDate,
      groupBy: 'day',
      metrics: [
        'total_created',
        'total_confirmed',
        'total_cancelled',
        'total_completed',
        'total_no_show',
        'conversion_rate',
        'completion_rate',
      ],
    };

    return this.kpiEngine.calculateComplexMetrics(query);
  }

  // === ENDPOINTS DE CONFIGURACIÓN DE KPIs ===

  @Post('kpis')
  @ApiOperation({ summary: 'Create new KPI configuration' })
  async createKPIConfiguration(@Body() kpiData: ICreateKPIConfigData) {
    return this.kpiManager.createKPIConfiguration(kpiData);
  }

  @Get('kpis')
  @ApiOperation({ summary: 'Get all KPI configurations' })
  async getKPIConfigurations(
    @Query('entityType') entityType?: string,
    @Query('isActive') isActive?: boolean,
    @Query('isRealTime') isRealTime?: boolean,
  ) {
    return this.kpiManager.getKPIConfigurations({
      entityType,
      isActive,
      isRealTime,
    });
  }

  @Get('kpis/:kpiCode')
  @ApiOperation({ summary: 'Get specific KPI configuration' })
  async getKPIConfiguration(@Param('kpiCode') kpiCode: string) {
    return this.kpiManager.getKPIConfiguration(kpiCode);
  }

  @Put('kpis/:kpiCode')
  @ApiOperation({ summary: 'Update KPI configuration' })
  async updateKPIConfiguration(
    @Param('kpiCode') kpiCode: string,
    @Body() updateData: IKPIConfigUpdate,
  ) {
    return this.kpiManager.updateKPIConfiguration(kpiCode, updateData);
  }

  @Delete('kpis/:kpiCode')
  @ApiOperation({ summary: 'Delete KPI configuration' })
  async deleteKPIConfiguration(@Param('kpiCode') kpiCode: string) {
    await this.kpiManager.deleteKPIConfiguration(kpiCode);

    return { message: 'KPI configuration deleted successfully' };
  }

  @Post('kpis/:kpiCode/calculate')
  @ApiOperation({ summary: 'Manually calculate KPI for specific period' })
  async calculateKPIManually(
    @Param('kpiCode') kpiCode: string,
    @Body()
    params: {
      companyId: string;
      periodDate: string;
      periodType: string;
    },
  ) {
    return this.kpiManager.calculateKPIManually(
      kpiCode,
      params.companyId,
      new Date(params.periodDate),
      params.periodType,
    );
  }

  @Get('kpis/:kpiCode/values')
  @ApiOperation({ summary: 'Get KPI values for date range' })
  async getKPIValues(
    @Param('kpiCode') kpiCode: string,
    @Query('companyId') companyId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('periodType') periodType?: string,
  ) {
    return this.kpiManager.getKPIValues(
      kpiCode,
      companyId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      periodType,
    );
  }

  @Get('kpis/:kpiCode/statistics')
  @ApiOperation({ summary: 'Get KPI statistics' })
  async getKPIStatistics(
    @Param('kpiCode') kpiCode: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.kpiManager.getKPIStatistics(kpiCode, companyId);
  }

  @Get('kpis/:kpiCode/trends')
  @ApiOperation({ summary: 'Get KPI trends and analysis' })
  async getKPITrends(
    @Param('kpiCode') kpiCode: string,
    @Query('companyId') companyId: string,
    @Query('periodType') periodType: string = 'MONTHLY',
    @Query('periods') periods: number = 12,
  ) {
    return this.kpiManager.getKPITrends(
      kpiCode,
      companyId,
      periodType,
      parseInt(periods.toString()),
    );
  }

  // === ENDPOINTS DE ADMINISTRACIÓN ===

  @Post('admin/recalculate/:companyId')
  @ApiOperation({ summary: 'Recalculate all KPIs for a company' })
  async recalculateCompanyKPIs(
    @Param('companyId') companyId: string,
    @Query('date') date?: string,
  ) {
    await this.kpiManager.recalculateCompanyKPIs(companyId, date ? new Date(date) : new Date());

    return { message: 'KPI recalculation started for company' };
  }

  @Post('admin/maintenance')
  @ApiOperation({ summary: 'Run maintenance job manually' })
  async runMaintenanceJob() {
    await this.analyticsJobs.runMaintenanceNow();

    return { message: 'Maintenance job completed' };
  }

  @Post('admin/setup-kpis')
  @ApiOperation({ summary: 'Create predefined appointment KPIs' })
  async setupAppointmentKPIs() {
    await this.kpiManager.createAppointmentKPIs();

    return { message: 'Predefined appointment KPIs created' };
  }

  @Get('admin/stats')
  @ApiOperation({ summary: 'Get system analytics statistics' })
  async getSystemStats() {
    // Implementar estadísticas del sistema
    return {
      message: 'System stats endpoint - implement based on your needs',
      timestamp: new Date().toISOString(),
    };
  }

  // === EJEMPLOS DE USO ===

  @Post('examples/comprehensive-analysis')
  @ApiOperation({ summary: 'Example: Comprehensive appointment analysis' })
  async comprehensiveAnalysisExample(
    @Body() params: { companyId: string; startDate: string; endDate: string },
  ) {
    const query: IComplexQuery = {
      companyId: params.companyId,
      startDate: new Date(params.startDate),
      endDate: new Date(params.endDate),
      groupBy: 'week',
      conditions: [
        {
          field: 'entity_type',
          operator: '=',
          value: 'appointments',
        },
        {
          field: 'change_type',
          operator: '=',
          value: 'STATUS_CHANGE',
        },
        {
          field: "(after_data->>'status')",
          operator: 'IN',
          value: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
        },
      ],
      metrics: [
        'total_created',
        'total_confirmed',
        'total_completed',
        'total_cancelled',
        'total_no_show',
        'avg_duration',
      ],
    };

    return {
      analysis: await this.kpiEngine.calculateComplexMetrics(query),
      description: 'Weekly appointment completion analysis with status breakdown',
    };
  }

  @Post('examples/employee-performance')
  @ApiOperation({ summary: 'Example: Employee performance analysis' })
  async employeePerformanceExample(
    @Body() params: { companyId: string; employeeId: string; startDate: string; endDate: string },
  ) {
    const query: IComplexQuery = {
      companyId: params.companyId,
      employeeId: params.employeeId,
      startDate: new Date(params.startDate),
      endDate: new Date(params.endDate),
      groupBy: 'day',
      conditions: [
        {
          field: "(after_data->>'actualDuration')::int",
          operator: '>=',
          value: 30,
        },
      ],
    };

    return {
      performance: await this.kpiEngine.calculateComplexMetrics(query),
      description: 'Daily performance analysis for specific employee (appointments 30+ minutes)',
    };
  }
}
