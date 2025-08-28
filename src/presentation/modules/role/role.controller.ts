/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { QueryBus, CommandBus } from '@nestjs/cqrs';
import { TrimStringPipe } from '@shared/pipes/trim-string.pipe';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { TransactionService } from '@infrastructure/database/prisma/transaction.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';

// Guards & Decorators
import { PermissionsGuard } from '@presentation/guards/permissions.guard';
import { RolesGuard } from '@presentation/guards/roles.guard';
import { RequirePermissions } from '@shared/decorators/permissions.decorator';
import { CanWrite, CanDelete } from '@shared/decorators/resource-permissions.decorator';
import { Roles } from '@shared/decorators/roles.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { RolesEnum } from '@shared/constants/enums';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';

// DTOs
import { CreateRoleDto } from '@application/dtos/role/create-role.dto';
import { UpdateRoleDto } from '@application/dtos/role/update-role.dto';
import { GetAssignablePermissionsDto } from '@application/dtos/permission/get-assignable-permissions.dto';
import { IAssignablePermissionResponse } from '@application/dtos/_responses/permission/assignable-permission.response.interface';
import { ICurrentUserPermissionResponse } from '@application/dtos/_responses/permission/current-user-permission.response.interface';

// Queries
import { GetRolesQuery } from '@application/queries/role/get-roles.query';
import { GetRoleQuery } from '@application/queries/role/get-role.query';
import { GetAssignablePermissionsQuery } from '@application/queries/permission/get-assignable-permissions.query';
import { GetPermissionsForTargetRoleQuery } from '@application/queries/permission/get-permissions-for-target-role.query';
import { GetCurrentUserPermissionsQuery } from '@application/queries/permission/get-current-user-permissions.query';

// Commands
import { CreateRoleCommand } from '@application/commands/role/create-role.command';
import { UpdateRoleCommand } from '@application/commands/role/update-role.command';
import { DeleteRoleCommand } from '@application/commands/role/delete-role.command';
import { AssignPermissionCommand } from '@application/commands/role/assign-permission.command';
import { RemovePermissionCommand } from '@application/commands/role/remove-permission.command';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { NoBots } from '@shared/decorators/bot-restrictions.decorator';

@ApiTags('roles')
@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@NoBots()
@RequirePermissions('role:read')
@ApiBearerAuth('JWT-auth')
export class RoleController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    private readonly transactionService: TransactionService,
    private readonly transactionContext: TransactionContextService,
  ) {}

  private async executeInTransactionWithContext<T>(callback: () => Promise<T>): Promise<T> {
    return this.transactionService.executeInTransaction(async (tx) => {
      this.transactionContext.setTransactionClient(tx);

      try {
        return await callback();
      } finally {
        this.transactionContext.clearTransaction();
      }
    });
  }

  @Get()
  @Roles(
    RolesEnum.ROOT,
    RolesEnum.ROOT_READONLY,
    RolesEnum.ADMIN,
    RolesEnum.MANAGER,
    RolesEnum.SALES_AGENT,
    RolesEnum.HOST,
    RolesEnum.GUEST,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all roles (All authenticated users)',
    description: 'Get all available roles in the system\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">role:read</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code>',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Returns a list of all roles' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permissions',
  })
  async getAllRoles() {
    return this.queryBus.execute(new GetRolesQuery());
  }

  @Get('permissions/assignable')
  @Roles(
    RolesEnum.ROOT,
    RolesEnum.ADMIN,
    RolesEnum.MANAGER,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get assignable permissions for current user role',
    description: 'Get list of permissions that the current user can assign to roles, filtered by exclude rules\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">role:read</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code>\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code>',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns permissions with assignability status and exclude reasons',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
          name: { type: 'string', example: 'user:read' },
          description: { type: 'string', example: 'Read user information' },
          resource: { type: 'string', example: 'user' },
          action: { type: 'string', example: 'read' },
          canAssign: { type: 'boolean', example: true },
          excludeReason: { type: 'string', example: 'Role \'guest\' is specifically excluded from this permission', nullable: true },
        },
      },
      example: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'user:read',
          description: 'Read user information',
          resource: 'user',
          action: 'read',
          canAssign: true,
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'user:write',
          description: 'Create and update user information',
          resource: 'user',
          action: 'write',
          canAssign: false,
          excludeReason: 'Role \'manager\' is specifically excluded from this permission',
        },
      ],
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permissions',
  })
  async getAssignablePermissions(
    @CurrentUser() currentUser: IJwtPayload,
    @Query() query: GetAssignablePermissionsDto,
  ): Promise<IAssignablePermissionResponse[]> {
    // Use all user roles to determine combined permissions
    return await this.queryBus.execute(
      new GetAssignablePermissionsQuery(currentUser.roles, query.targetRoleName),
    );
  }

  @Get('permissions/assignable-to/:targetRoleName')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get permissions that a specific role can have',
    description: 'Get list of all permissions showing which ones can be assigned to the specified target role based on exclude rules. This endpoint focuses on the target role\'s restrictions, not the current user\'s permissions.\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">role:read</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code>',
  })
  @ApiParam({
    name: 'targetRoleName',
    description: 'Name of the target role to check permissions for',
    example: 'admin',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns permissions that can be assigned to the target role',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
          name: { type: 'string', example: 'user:read' },
          description: { type: 'string', example: 'Read user information' },
          resource: { type: 'string', example: 'user' },
          action: { type: 'string', example: 'read' },
          canAssign: { type: 'boolean', example: true },
          excludeReason: { type: 'string', example: 'Target role \'guest\' is excluded from this permission', nullable: true },
        },
      },
      example: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'user:read',
          description: 'Read user information',
          resource: 'user',
          action: 'read',
          canAssign: true,
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'company:delete',
          description: 'Delete company information',
          resource: 'company',
          action: 'delete',
          canAssign: false,
          excludeReason: 'Target role \'manager\' is excluded from this permission',
        },
      ],
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permissions',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Target role not found',
  })
  async getAssignablePermissionsToRole(
    @CurrentUser() currentUser: IJwtPayload,
    @Param('targetRoleName', TrimStringPipe) targetRoleName: string,
  ): Promise<IAssignablePermissionResponse[]> {
    // Check permissions that can be assigned to the specific target role
    return await this.queryBus.execute(
      new GetPermissionsForTargetRoleQuery(targetRoleName),
    );
  }

  @Get('permissions/current')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get current user permissions',
    description: 'Get all permissions that the current authenticated user has based on their roles\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">None (Authenticated)</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code>',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns all permissions granted to the current user',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
          name: { type: 'string', example: 'user:read' },
          description: { type: 'string', example: 'Permission to read user data' },
          resource: { type: 'string', example: 'user' },
          action: { type: 'string', example: 'read' },
          grantedByRole: { type: 'string', example: 'admin' },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async getCurrentUserPermissions(
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<ICurrentUserPermissionResponse[]> {
    return await this.queryBus.execute(
      new GetCurrentUserPermissionsQuery(currentUser.sub),
    );
  }

  @Get(':id')
  @Roles(
    RolesEnum.ROOT,
    RolesEnum.ROOT_READONLY,
    RolesEnum.ADMIN,
    RolesEnum.MANAGER,
    RolesEnum.SALES_AGENT,
    RolesEnum.HOST,
    RolesEnum.GUEST,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get role by ID (All authenticated users)',
    description: 'Get detailed information about a specific role\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">role:read</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code>',
  })
  @ApiParam({ name: 'id', description: 'Role ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Returns role information' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Role not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permissions',
  })
  async getRoleById(@Param('id', TrimStringPipe) id: string) {
    return this.queryBus.execute(new GetRoleQuery(id));
  }

  @Post()
  @Roles(RolesEnum.ROOT)
  @CanWrite('role')
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({
    type: CreateRoleDto,
    description: 'Role creation data including name (from RolesEnum), description, hierarchy level (2-5), and optional permission IDs',
  })
  @ApiOperation({
    summary: 'Create new role (Root only)',
    description: 'Create a new role in the system with hierarchy level restrictions\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">role:write</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n\n' +
      '📈 **Hierarchy Rules:** Root users can create roles with hierarchy levels 2-5 (admin, manager, sales_agent, host, guest)\n\n' +
      '⚠️ **Restrictions:** Root readonly users cannot perform this operation. Cannot create root-level roles (hierarchy level 1).',
  })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Role created successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permission or hierarchy level restriction violated',
  })
  async createRole(
    @Body() createRoleDto: CreateRoleDto,
    @CurrentUser() currentUser: IJwtPayload,
  ) {
    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(
        new CreateRoleCommand(
          createRoleDto.name,
          createRoleDto.description,
          createRoleDto.hierarchyLevel,
          createRoleDto.isDefault,
          createRoleDto.permissionIds,
          createRoleDto.isDefaultAppRole,
          currentUser.sub,
        ),
      );
    });
  }

  @Put(':id')
  @Roles(RolesEnum.ROOT)
  @CanWrite('role')
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    type: UpdateRoleDto,
    description: 'Role update data. All fields are optional. Only provided fields will be updated.',
  })
  @ApiOperation({
    summary: 'Update role by ID (Root only)',
    description: 'Update role information\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">role:write</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n\n' +
      '⚠️ **Restrictions:** Root readonly users cannot perform this operation',
  })
  @ApiParam({ name: 'id', description: 'Role ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Role updated successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Role not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permission',
  })
  async updateRole(@Param('id', TrimStringPipe) id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(
        new UpdateRoleCommand(
          id,
          updateRoleDto.name,
          updateRoleDto.description,
          updateRoleDto.isDefault,
        ),
      );
    });
  }

  @Delete(':id')
  @Roles(RolesEnum.ROOT)
  @CanDelete('role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete role by ID (Root only)',
    description: 'Delete a role from the system\n\n' +
      '📋 **Required Permission:** <code style="color: #c0392b; background: #fadbd8; padding: 2px 6px; border-radius: 3px; font-weight: bold;">role:delete</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n\n' +
      '⚠️ **Restrictions:** Root readonly users cannot perform this operation',
  })
  @ApiParam({ name: 'id', description: 'Role ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Role deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Role not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permission',
  })
  async deleteRole(@Param('id', TrimStringPipe) id: string) {
    await this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(new DeleteRoleCommand(id));
    });

    return { message: 'Role deleted successfully' };
  }

  @Post(':roleId/permissions/:permissionId')
  @Roles(RolesEnum.ROOT)
  @CanWrite('role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assign permission to role (Root only)',
    description: 'Assign a permission to a specific role\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">role:write</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n\n' +
      '⚠️ **Restrictions:** Root readonly users cannot perform this operation',
  })
  @ApiParam({
    name: 'roleId',
    description: 'Role ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiParam({
    name: 'permissionId',
    description: 'Permission ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Permission assigned to role successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Role or permission not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permission',
  })
  async assignPermissionToRole(
    @Param('roleId', TrimStringPipe) roleId: string,
    @Param('permissionId', TrimStringPipe) permissionId: string,
  ) {
    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(new AssignPermissionCommand(roleId, permissionId));
    });
  }

  @Delete(':roleId/permissions/:permissionId')
  @Roles(RolesEnum.ROOT)
  @CanWrite('role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove permission from role (Root only)',
    description: 'Remove a permission from a specific role\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">role:write</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n\n' +
      '⚠️ **Restrictions:** Root readonly users cannot perform this operation',
  })
  @ApiParam({
    name: 'roleId',
    description: 'Role ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiParam({
    name: 'permissionId',
    description: 'Permission ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Permission removed from role successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Role or permission not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permission',
  })
  async removePermissionFromRole(
    @Param('roleId', TrimStringPipe) roleId: string,
    @Param('permissionId', TrimStringPipe) permissionId: string,
  ) {
    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(new RemovePermissionCommand(roleId, permissionId));
    });
  }
}
