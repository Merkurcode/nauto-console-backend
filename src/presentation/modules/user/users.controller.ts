import { Controller, Get, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

// Guards & Decorators
import { RolesGuard } from '@presentation/guards/roles.guard';
import { PermissionsGuard } from '@presentation/guards/permissions.guard';
import { RequirePermissions } from '@shared/decorators/permissions.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';

// Queries
import { GetUserWithAuthorizationQuery } from '@application/queries/user/get-user-with-authorization.query';

// DTOs
import { IJwtPayload } from '@application/dtos/responses/user.response';

@ApiTags('users')
@Controller('users')
@UseGuards(RolesGuard, PermissionsGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id')
  @RequirePermissions('user:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get user by ID with company-based access control',
    description:
      'Get detailed information about a specific user by ID with role-based access control:\n\n' +
      '- **Root/Root-Readonly**: Can access any user\n' +
      '- **Admin**: Can access users from their company and child companies\n' +
      '- **Manager, Sales Agent, Host, Guest**: Can only access their own profile\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">user:read</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code>',
  })
  @ApiParam({ name: 'id', description: 'User ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Returns user information' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have permission to access this user',
  })
  async getUserById(@Param('id') id: string, @CurrentUser() currentUser: IJwtPayload) {
    return this.queryBus.execute(new GetUserWithAuthorizationQuery(id, currentUser.sub));
  }
}
