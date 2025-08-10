import { AuditLog } from '@core/entities/audit-log.entity';
import {
  BotAuditLogResponse,
  BotAuditResponse,
} from '@application/dtos/_responses/bot/bot-audit.response';

export class BotAuditMapper {
  /**
   * Convert domain AuditLog entity to response DTO
   */
  static toAuditLogResponse(auditLog: AuditLog): BotAuditLogResponse {
    return {
      id: auditLog.id.getValue(),
      timestamp: auditLog.timestamp.toISOString(),
      action: auditLog.action,
      resource: auditLog.metadata.resource || 'unknown',
      method: auditLog.metadata.method || 'unknown',
      path: (auditLog.metadata.path as string) || 'unknown',
      statusCode: auditLog.metadata.statusCode as number | undefined,
      duration: auditLog.metadata.duration ? String(auditLog.metadata.duration) : undefined,
      botAlias: (auditLog.metadata.botAlias as string) || auditLog.userId?.getValue() || 'unknown',
      tokenId: auditLog.metadata.tokenId as string | undefined,
      companyId: auditLog.metadata.companyId as string | undefined,
      ipAddress: auditLog.metadata.ipAddress as string | undefined,
      userAgent: auditLog.metadata.userAgent as string | undefined,
      requestId: auditLog.metadata.requestId as string | undefined,
      query: auditLog.metadata.query as Record<string, any> | undefined,
      params: auditLog.metadata.params as Record<string, any> | undefined,
      error: auditLog.metadata.error as Record<string, any> | undefined,
    };
  }

  /**
   * Convert array of domain AuditLog entities to BotAuditResponse
   */
  static toBotAuditResponse(
    auditLogs: AuditLog[],
    filters: Record<string, any>,
    appliedBy: string,
  ): BotAuditResponse {
    const logs = auditLogs.map(log => this.toAuditLogResponse(log));

    return {
      logs,
      total: logs.length,
      filters: {
        ...filters,
        appliedBy,
        appliedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Calculate method breakdown from audit logs
   */
  static getMethodBreakdown(logs: AuditLog[]): Record<string, number> {
    const methods: Record<string, number> = {};
    logs.forEach(log => {
      const method = log.metadata.method || 'UNKNOWN';
      methods[method] = (methods[method] || 0) + 1;
    });

    return methods;
  }

  /**
   * Calculate status code breakdown from audit logs
   */
  static getStatusCodeBreakdown(logs: AuditLog[]): Record<string, number> {
    const codes: Record<string, number> = {};
    logs.forEach(log => {
      const code = log.metadata.statusCode || 'UNKNOWN';
      codes[code] = (codes[code] || 0) + 1;
    });

    return codes;
  }

  /**
   * Calculate average response time from audit logs
   */
  static calculateAverageResponseTime(logs: AuditLog[]): string {
    const durations = logs
      .map(log => log.metadata.duration)
      .filter(
        duration => duration && typeof duration === 'string' && (duration as string).endsWith('ms'),
      )
      .map(duration => parseInt((duration as string).replace('ms', '')));

    if (durations.length === 0) return '0ms';

    const average = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;

    return `${Math.round(average)}ms`;
  }

  /**
   * Get top endpoints from audit logs
   */
  static getTopEndpoints(
    logs: AuditLog[],
    limit: number = 10,
  ): Array<{ endpoint: string; count: number }> {
    const endpoints: Record<string, number> = {};
    logs.forEach(log => {
      const endpoint = `${log.metadata.method || 'UNKNOWN'} ${log.metadata.path || 'unknown'}`;
      endpoints[endpoint] = (endpoints[endpoint] || 0) + 1;
    });

    return Object.entries(endpoints)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, limit)
      .map(([endpoint, count]) => ({ endpoint, count }));
  }
}
