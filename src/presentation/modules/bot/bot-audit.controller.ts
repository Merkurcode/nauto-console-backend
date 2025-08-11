import { Controller, Get, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

// Guards and decorators
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { RolesGuard } from '@presentation/guards/roles.guard';
import { PermissionsGuard } from '@presentation/guards/permissions.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { Roles } from '@shared/decorators/roles.decorator';
import { RequirePermissions } from '@shared/decorators/permissions.decorator';
import { RolesEnum } from '@shared/constants/enums';

// Services
import { AuditLogService } from '@core/services/audit-log.service';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';

// DTOs and Mappers
import { BotAuditQueryDto } from '@application/dtos/bot/bot-audit-query.dto';
import {
  BotAuditResponse,
  BotStatisticsResponse,
} from '@application/dtos/_responses/bot/bot-audit.response';
import { BotAuditMapper } from '@application/mappers/bot-audit.mapper';
import { NoBots } from '@shared/decorators/bot-restrictions.decorator';

/**
 * Controlador para consultar logs de auditoría del BOT
 * - Solo accesible para usuarios ROOT
 * - Permite filtrar y analizar actividad del BOT
 * - Datos sanitizados para proteger información sensible
 */
@ApiTags('bot-audit')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@NoBots()
@Roles(RolesEnum.ROOT)
@Controller('bot-audit')
export class BotAuditController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get('activity')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('audit:read')
  @ApiOperation({
    summary: 'Query BOT activity logs',
    description:
      'Retrieve and filter BOT activity logs from database. Only ROOT users with audit:read permission can access.\n\n' +
      '📋 **Required Permission:** <code style=\"color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;\">audit:read</code>\n\n' +
      '👥 **Roles with Access:** <code style=\"color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;\">ROOT</code>',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'BOT activity logs retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        logs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'audit-log-uuid' },
              timestamp: { type: 'string', example: '2025-08-07T10:30:00Z' },
              action: { type: 'string', example: 'BOT_REQUEST_SUCCESS' },
              resource: { type: 'string', example: 'GET /users' },
              method: { type: 'string', example: 'GET' },
              path: { type: 'string', example: '/users' },
              statusCode: { type: 'number', example: 200 },
              duration: { type: 'string', example: '150ms' },
              botAlias: { type: 'string', example: 'chatbot-external-001' },
              tokenId: { type: 'string', example: 'bot_1691424000_abc123def456' },
              companyId: { type: 'string', example: 'company-uuid' },
              ipAddress: { type: 'string', example: '192.168.1.100' },
              userAgent: { type: 'string', example: 'ChatbotClient/1.0' },
            },
          },
        },
        total: { type: 'number', example: 25 },
        filters: { type: 'object' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Only ROOT users with audit:read permission can access BOT audit logs',
  })
  async queryBotActivity(
    @Query() queryDto: BotAuditQueryDto,
    @CurrentUser() user: IJwtPayload,
  ): Promise<BotAuditResponse> {
    // Query BOT activity logs
    const auditLogs = await this.auditLogService.queryBotActivity(
      {
        botAlias: queryDto.botAlias,
        companyId: queryDto.companyId,
        tokenId: queryDto.tokenId,
        method: queryDto.method,
        path: queryDto.path,
        statusCode: queryDto.statusCode,
        fromDate: queryDto.fromDate,
        toDate: queryDto.toDate,
      },
      queryDto.limit || 100,
    );

    // Use mapper to transform to response format
    return BotAuditMapper.toBotAuditResponse(
      auditLogs,
      {
        botAlias: queryDto.botAlias,
        companyId: queryDto.companyId,
        tokenId: queryDto.tokenId,
        method: queryDto.method,
        path: queryDto.path,
        statusCode: queryDto.statusCode,
        fromDate: queryDto.fromDate?.toISOString(),
        toDate: queryDto.toDate?.toISOString(),
        limit: queryDto.limit,
      },
      user.sub,
    );
  }

  @Get('statistics')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('audit:read')
  @ApiOperation({
    summary: 'Get BOT activity statistics',
    description:
      'Get aggregated statistics of BOT activity. Only ROOT users with audit:read permission can access.\n\n' +
      '📋 **Required Permission:** <code style=\"color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;\">audit:read</code>\n\n' +
      '👥 **Roles with Access:** <code style=\"color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;\">ROOT</code>',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'BOT statistics retrieved successfully',
  })
  async getBotStatistics(
    @CurrentUser() user: IJwtPayload,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ): Promise<BotStatisticsResponse> {
    const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate) : new Date();

    // Get general statistics (this will include BOT logs)
    const stats = await this.auditLogService.getStatistics(from, to);

    // Get BOT-specific logs for detailed analysis
    const botLogs = await this.auditLogService.queryBotActivity(
      {
        fromDate: from,
        toDate: to,
      },
      1000,
    );

    // Calculate BOT-specific statistics using mapper
    const botStats = {
      totalRequests: botLogs.length,
      successfulRequests: botLogs.filter(
        log =>
          log.metadata.statusCode &&
          (log.metadata.statusCode as number) >= 200 &&
          (log.metadata.statusCode as number) < 300,
      ).length,
      errorRequests: botLogs.filter(
        log => log.metadata.statusCode && (log.metadata.statusCode as number) >= 400,
      ).length,
      methodBreakdown: BotAuditMapper.getMethodBreakdown(botLogs),
      statusCodeBreakdown: BotAuditMapper.getStatusCodeBreakdown(botLogs),
      averageResponseTime: BotAuditMapper.calculateAverageResponseTime(botLogs),
      topEndpoints: BotAuditMapper.getTopEndpoints(botLogs),
      uniqueTokens: new Set(botLogs.map(log => log.metadata.tokenId)).size,
      dateRange: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
    };

    return {
      general: stats,
      botSpecific: botStats,
      generatedBy: user.sub,
      generatedAt: new Date().toISOString(),
    };
  }
}
