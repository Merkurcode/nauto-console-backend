import { ApiProperty } from '@nestjs/swagger';

export class BotAuditLogResponse {
  @ApiProperty({ example: 'audit-log-uuid' })
  id: string;

  @ApiProperty({ example: '2025-08-07T10:30:00Z' })
  timestamp: string;

  @ApiProperty({ example: 'BOT_REQUEST_SUCCESS' })
  action: string;

  @ApiProperty({ example: 'GET /users' })
  resource: string;

  @ApiProperty({ example: 'GET' })
  method: string;

  @ApiProperty({ example: '/users' })
  path: string;

  @ApiProperty({ example: 200, required: false })
  statusCode?: number;

  @ApiProperty({ example: '150ms', required: false })
  duration?: string;

  @ApiProperty({ example: 'chatbot-external-001' })
  botAlias: string;

  @ApiProperty({ example: 'bot_1691424000_abc123def456', required: false })
  tokenId?: string;

  @ApiProperty({ example: 'company-uuid', required: false })
  companyId?: string;

  @ApiProperty({ example: '192.168.1.100', required: false })
  ipAddress?: string;

  @ApiProperty({ example: 'ChatbotClient/1.0', required: false })
  userAgent?: string;

  @ApiProperty({ example: 'req-12345', required: false })
  requestId?: string;

  @ApiProperty({ required: false })
  query?: Record<string, unknown>;

  @ApiProperty({ required: false })
  params?: Record<string, unknown>;

  @ApiProperty({ required: false })
  error?: Record<string, unknown>;
}

export class BotAuditResponse {
  @ApiProperty({
    type: [BotAuditLogResponse],
    description: 'List of bot audit logs',
  })
  logs: BotAuditLogResponse[];

  @ApiProperty({
    example: 25,
    description: 'Total number of logs returned',
  })
  total: number;

  @ApiProperty({
    description: 'Applied filters for this query',
  })
  filters: Record<string, unknown>;
}

export class BotStatisticsResponse {
  @ApiProperty({ description: 'General audit statistics' })
  general: Record<string, unknown>;

  @ApiProperty({ description: 'BOT-specific statistics' })
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

  @ApiProperty({ example: 'user-uuid' })
  generatedBy: string;

  @ApiProperty({ example: '2025-08-07T10:30:00Z' })
  generatedAt: string;
}
