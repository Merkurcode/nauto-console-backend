import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Put,
  Delete,
  Patch,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { QueryBus, CommandBus } from '@nestjs/cqrs';
import { TrimStringPipe } from '@shared/pipes/trim-string.pipe';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { TransactionService } from '@infrastructure/database/prisma/transaction.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';

// Guards & Decorators
import { RolesGuard } from '@presentation/guards/roles.guard';
import { PermissionsGuard } from '@presentation/guards/permissions.guard';
import { RootAssignmentGuard } from '@presentation/guards/root-assignment.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { RolesEnum } from '@shared/constants/enums';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { CanWrite, CanDelete } from '@shared/decorators/resource-permissions.decorator';
import { RequirePermissions } from '@shared/decorators/permissions.decorator';
import { PreventRootAssignment } from '@shared/decorators/prevent-root-assignment.decorator';

// DTOs
import { UpdateUserProfileDto } from '@application/dtos/user/update-user-profile.dto';
import { ActivateUserDto } from '@application/dtos/user/activate-user.dto';
import { AssignRoleDto } from '@application/dtos/user/assign-role.dto';
import { SearchUsersRequestDto } from '@application/dtos/_requests/user/search-users.request';
import {
  ISearchUsersResponse,
  SearchUsersResponseDto,
  IJwtPayload,
} from '@application/dtos/_responses/user/user.response';

// Queries
import { GetUsersQuery } from '@application/queries/user/get-users.query';
import { GetUserWithAuthorizationQuery } from '@application/queries/user/get-user-with-authorization.query';
import { SearchUsersQuery } from '@application/queries/user/search-users.query';

// Commands
import { UpdateUserProfileCommand } from '@application/commands/user/update-user-profile.command';
import { DeleteUserCommand } from '@application/commands/user/delete-user.command';
import { ActivateUserCommand } from '@application/commands/user/activate-user.command';
import { AssignRoleCommand } from '@application/commands/user/assign-role.command';
import { RemoveRoleCommand } from '@application/commands/user/remove-role.command';
import { UserDeletionPolicyService } from '@core/services/user-deletion-policy.service';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { NoBots } from '@shared/decorators/bot-restrictions.decorator';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, RootAssignmentGuard)
@ApiBearerAuth('JWT-auth')
export class UserController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    private readonly transactionService: TransactionService,
    private readonly transactionContext: TransactionContextService,
    private readonly userDeletionPolicyService: UserDeletionPolicyService,
  ) {}

  private async executeInTransactionWithContext<T>(callback: () => Promise<T>): Promise<T> {
    return this.transactionService.executeInTransaction(async tx => {
      this.transactionContext.setTransactionClient(tx);

      try {
        return await callback();
      } finally {
        this.transactionContext.clearTransaction();
      }
    });
  }

  @Get()
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY, RolesEnum.ADMIN)
  @RequirePermissions('user:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all users in company (Root/Root-Readonly/Admin)',
    description:
      'Get all users within a specific company. Admin users can only see users from their own company. Response includes user details, roles, tenantId, and companyId.\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">user:read</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n' +
      '- <code style="color: #e17055; background: #fab1a0; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT_READONLY</code>\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code>',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns a list of all users in the company with complete profile information',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
          email: { type: 'string', example: 'user@example.com' },
          firstName: { type: 'string', example: 'John' },
          lastName: { type: 'string', example: 'Doe' },
          secondLastName: { type: 'string', example: 'Smith', nullable: true },
          emailVerified: { type: 'boolean', example: true },
          isActive: { type: 'boolean', example: true },
          otpEnabled: { type: 'boolean', example: false },
          lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
          bannedUntil: { type: 'string', format: 'date-time', nullable: true },
          banReason: { type: 'string', nullable: true },
          agentPhone: { type: 'string', example: '+1234567890', nullable: true },
          agentPhoneCountryCode: { type: 'string', example: '+1', nullable: true },
          profile: {
            type: 'object',
            nullable: true,
            properties: {
              phone: { type: 'string', example: '+1234567890', nullable: true },
              phoneCountryCode: { type: 'string', example: '+1', nullable: true },
              avatarUrl: {
                type: 'string',
                example: 'https://example.com/avatar.jpg',
                nullable: true,
              },
              bio: { type: 'string', example: 'Software Developer', nullable: true },
              birthDate: { type: 'string', format: 'date', example: '1990-01-01', nullable: true },
            },
          },
          address: {
            type: 'object',
            nullable: true,
            properties: {
              country: { type: 'string', example: 'Mexico', nullable: true },
              state: { type: 'string', example: 'Jalisco', nullable: true },
              city: { type: 'string', example: 'Guadalajara', nullable: true },
              street: { type: 'string', example: 'Av. Revolución', nullable: true },
              exteriorNumber: { type: 'string', example: '123', nullable: true },
              interiorNumber: { type: 'string', example: 'A', nullable: true },
              postalCode: { type: 'string', example: '44100', nullable: true },
            },
          },
          roles: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
              },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          tenantId: {
            type: 'string',
            nullable: true,
            example: '550e8400-e29b-41d4-a716-446655440001',
          },
          companyId: {
            type: 'string',
            nullable: true,
            example: '550e8400-e29b-41d4-a716-446655440001',
          },
          smsStatus: { type: 'string', example: 'SENT' },
          emailStatus: { type: 'string', example: 'SENT' },
          lastSmsError: { type: 'string', nullable: true },
          lastEmailError: { type: 'string', nullable: true },
          invitationStatus: {
            type: 'object',
            nullable: true,
            properties: {
              status: { type: 'string', enum: ['pending', 'completed', 'error', 'expired'] },
              otpTimeRemaining: {
                type: 'string',
                nullable: true,
                example: '5 minutes and 30 seconds',
              },
              details: {
                type: 'object',
                properties: {
                  emailStatus: { type: 'string' },
                  smsStatus: { type: 'string' },
                  emailVerified: { type: 'boolean' },
                  errorMessage: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permissions',
  })
  async getAllUsers(@CurrentUser() currentUser: IJwtPayload) {
    return this.queryBus.execute(new GetUsersQuery(currentUser.companyId!, currentUser.sub));
  }

  @Get('search')
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY, RolesEnum.ADMIN, RolesEnum.MANAGER)
  @RequirePermissions('user:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search and filter users within a company',
    description:
      'Advanced user search with filtering and pagination. Returns complete user details including profile, address, roles, and status information.\n\n' +
      '**🔍 Search Capabilities:**\n' +
      '- Text search across: firstName, lastName, secondLastName, and email\n' +
      '- Filter by user status (active/inactive)\n' +
      '- Filter by email verification status\n' +
      '- Paginated results with configurable limit (1-100) and offset\n\n' +
      '**🏢 Multi-Tenant Isolation:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px;">⚠️ Company ID is REQUIRED (UUID format)</code>\n' +
      '- Users can only access data from their assigned company\n' +
      '- Access control is automatically enforced based on user role and company assignment\n\n' +
      '**📋 Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">user:read</code>\n\n' +
      '**👥 Authorized Roles:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code> - Can search users in any company\n' +
      '- <code style="color: #e17055; background: #fab1a0; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT_READONLY</code> - Can search users in any company (read-only)\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code> - Can search users within assigned company\n' +
      '- <code style="color: #6c5ce7; background: #a29bfe; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code> - Can search users within assigned company\n\n' +
      '**📦 Response Format:**\n' +
      'Returns IUserDetailResponse array with complete user information including:\n' +
      '- Basic info (id, email, names)\n' +
      '- Status (active, verified, banned)\n' +
      '- Profile (phone, avatar, bio)\n' +
      '- Address (country, state, city)\n' +
      '- Roles and permissions\n' +
      '- Invitation and verification status',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'User search completed successfully. Returns paginated results with full user details.',
    type: SearchUsersResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request parameters. Company ID must be a valid UUID v4.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'Access denied. User does not have permission to search users or access the specified company.',
  })
  async searchUsers(
    @Query() searchDto: SearchUsersRequestDto,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<ISearchUsersResponse> {
    return this.queryBus.execute(
      new SearchUsersQuery(
        searchDto.companyId,
        searchDto.limit,
        searchDto.offset,
        searchDto.onlyActive,
        searchDto.onlyEmailVerified,
        currentUser,
        searchDto.query,
      ),
    );
  }

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
  async getUserById(
    @Param('id', TrimStringPipe) id: string,
    @CurrentUser() currentUser: IJwtPayload,
  ) {
    return this.queryBus.execute(new GetUserWithAuthorizationQuery(id, currentUser.sub));
  }

  @Put(':id')
  @NoBots()
  @Roles(
    RolesEnum.ROOT,
    RolesEnum.ROOT_READONLY,
    RolesEnum.ADMIN,
    RolesEnum.MANAGER,
    RolesEnum.SALES_AGENT,
    RolesEnum.HOST,
    RolesEnum.GUEST,
  )
  @CanWrite('user')
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    type: UpdateUserProfileDto,
    description:
      'User profile update data. All fields are optional. Only provided fields will be updated.',
  })
  @ApiOperation({
    summary: 'Update user profile (All roles with restrictions)',
    description:
      'Update user information with company-based access control:\n\n' +
      '- **Root/Root-Readonly**: Can edit any user\n' +
      '- **Admin**: Can edit users from their company and child companies\n' +
      '- **Manager, Sales Agent, Host, Guest**: Can only edit their own profile\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">user:write</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code>\n\n' +
      '⚠️ **Restrictions:** Role-based access control applies',
  })
  @ApiParam({ name: 'id', description: 'User ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User updated successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permissions',
  })
  async updateUser(
    @Param('id', TrimStringPipe) id: string,
    @Body() updateUserDto: UpdateUserProfileDto,
    @CurrentUser() currentUser: IJwtPayload,
  ) {
    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(
        new UpdateUserProfileCommand(id, currentUser.sub, updateUserDto),
      );
    });
  }

  @Delete(':id')
  @NoBots()
  @Roles(RolesEnum.ROOT, RolesEnum.ADMIN, RolesEnum.MANAGER)
  @CanDelete('user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete user by ID (Root/Admin/Manager with hierarchy restrictions)',
    description:
      'Delete a user from a specific company with role hierarchy restrictions\n\n' +
      '📋 **Required Permission:** <code style="color: #c0392b; background: #fadbd8; padding: 2px 6px; border-radius: 3px; font-weight: bold;">user:delete</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code>\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code>\n\n' +
      '⚠️ **Restrictions:** Root can delete any user. Admin can delete users in their company except root/admin. Manager can delete users below their hierarchy level.',
  })
  @ApiParam({ name: 'id', description: 'User ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permissions',
  })
  async deleteUser(
    @Param('id', TrimStringPipe) id: string,
    @CurrentUser() currentUser: IJwtPayload,
  ) {
    // Check if user deletion is allowed in current environment
    this.userDeletionPolicyService.enforceUserDeletionPolicy();

    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(
        new DeleteUserCommand(id, currentUser.sub, currentUser.companyId!),
      );
    });
  }

  @Patch(':id/activate')
  @NoBots()
  @Roles(RolesEnum.ROOT, RolesEnum.ADMIN)
  @CanWrite('user')
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    type: ActivateUserDto,
    description: 'User activation status (active: true/false)',
  })
  @ApiOperation({
    summary: 'Activate or deactivate user (Root/Admin)',
    description:
      'Change user activation status. Root can activate/deactivate any user. Admin can only activate/deactivate users in their company.\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">user:write</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code>\n\n' +
      '⚠️ **Restrictions:** Admin users can only modify users in their own company',
  })
  @ApiParam({ name: 'id', description: 'User ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User activation status updated' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permissions',
  })
  async activateUser(
    @Param('id', TrimStringPipe) id: string,
    @Body() activateUserDto: ActivateUserDto,
    @CurrentUser() currentUser: IJwtPayload,
  ) {
    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(
        new ActivateUserCommand(
          id,
          activateUserDto.active,
          currentUser.sub,
          currentUser.companyId!,
        ),
      );
    });
  }

  @Post(':id/roles')
  @NoBots()
  @Roles(RolesEnum.ROOT, RolesEnum.ADMIN)
  @CanWrite('user')
  @PreventRootAssignment()
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    type: AssignRoleDto,
    description: 'Role assignment data including the roleId to assign',
  })
  @ApiOperation({
    summary: 'Assign role to user (Root/Admin)',
    description:
      'Assign a role to a specific user. Root can assign any role to any user. Admin can only assign roles to users in their company. Root roles cannot be assigned by anyone.\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">user:write</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code>\n\n' +
      '⚠️ **Restrictions:** Root roles cannot be assigned. Admin users can only assign roles to users in their own company.',
  })
  @ApiParam({ name: 'id', description: 'User ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Role assigned successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User or role not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permissions',
  })
  async assignRoleToUser(
    @Param('id', TrimStringPipe) id: string,
    @Body() assignRoleDto: AssignRoleDto,
    @CurrentUser() currentUser: IJwtPayload,
  ) {
    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(
        new AssignRoleCommand(id, assignRoleDto.roleId, currentUser.companyId!, currentUser.sub),
      );
    });
  }

  @Delete(':id/roles/:roleId')
  @NoBots()
  @Roles(RolesEnum.ROOT, RolesEnum.ADMIN, RolesEnum.MANAGER)
  @CanWrite('user')
  @PreventRootAssignment() // Prevent removal of ROOT roles
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove role from user (Root/Admin/Manager)',
    description:
      'Remove a role from a specific user. Root can remove from any user. Admin can remove from users in their company. Manager can remove from users in their company but not superior roles.\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">user:write</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code>\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code>\n\n' +
      '⚠️ **Restrictions:** Role hierarchy applies',
  })
  @ApiParam({ name: 'id', description: 'User ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiParam({
    name: 'roleId',
    description: 'Role ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Role removed successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permissions',
  })
  async removeRoleFromUser(
    @Param('id', TrimStringPipe) id: string,
    @Param('roleId', TrimStringPipe) roleId: string,
    @CurrentUser() currentUser: IJwtPayload,
  ) {
    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(
        new RemoveRoleCommand(id, roleId, currentUser.sub, currentUser.companyId!),
      );
    });
  }
}
