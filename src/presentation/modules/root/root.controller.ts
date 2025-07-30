import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';

// Guards & Decorators
import { PermissionsGuard } from '@presentation/guards/permissions.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { RolesEnum } from '@shared/constants/enums';
import { RequiresSensitive } from '@shared/decorators/sensitive.decorator';
import { RequiresResourceAction } from '@shared/decorators/resource-action.decorator';

@ApiTags('root')
@Controller('root')
@UseGuards(PermissionsGuard)
@Roles(RolesEnum.ROOT)
@ApiBearerAuth('JWT-auth')
export class RootController {
  constructor() {}

  @Get('dashboard')
  @ApiExcludeEndpoint()
  @HttpCode(HttpStatus.OK)
  async getDashboard() {
    return {
      message: 'Root dashboard data',
      stats: {
        totalUsers: 0,
        activeUsers: 0,
        totalRoles: 0,
      },
    };
  }

  @Get('system-info')
  @HttpCode(HttpStatus.OK)
  @RequiresSensitive()
  @ApiOperation({ summary: 'Get system information (Requires 2FA)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Returns system information' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'User does not have 2FA enabled' })
  async getSystemInfo() {
    return {
      message: 'Sensitive system information',
      system: {
        version: '1.0.0',
        environment: process.env.NODE_ENV,
        uptime: process.uptime(),
      },
    };
  }

  @Get('audit-logs')
  @HttpCode(HttpStatus.OK)
  @RequiresResourceAction('audit', 'read')
  @ApiOperation({ summary: 'Get audit logs (Requires specific permission)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Returns audit logs' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have audit:read permission',
  })
  async getAuditLogs() {
    return {
      message: 'Root audit logs data',
      logs: [],
    };
  }
}
