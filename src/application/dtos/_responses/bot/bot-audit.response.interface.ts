export interface IBotAuditLogResponse {
  id: string;
  timestamp: string;
  action: string;
  resource: string;
  method: string;
  path: string;
  statusCode?: number;
  duration?: string;
  botAlias: string;
  tokenId?: string;
  companyId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  error?: Record<string, unknown>;
}

export interface IBotAuditResponse {
  logs: IBotAuditLogResponse[];
  total: number;
  filters: Record<string, unknown>;
}

export interface IBotStatisticsResponse {
  general: Record<string, unknown>;
  botSpecific: {
    totalRequests: number;
    successfulRequests: number;
    errorRequests: number;
    methodBreakdown: Record<string, number>;
    statusCodeBreakdown: Record<string, number>;
    averageResponseTime: string;
    topEndpoints: Array<{ endpoint: string; count: number }>;
    uniqueTokens: number;
    dateRange: {
      from: string;
      to: string;
    };
  };
  generatedBy: string;
  generatedAt: string;
}
