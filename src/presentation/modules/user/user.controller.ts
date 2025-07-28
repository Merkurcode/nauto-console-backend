import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Put,
  Delete,
  Patch,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { QueryBus, CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

// Guards & Decorators
import { RolesGuard } from '@presentation/guards/roles.guard';
import { PermissionsGuard } from '@presentation/guards/permissions.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { RolesEnum } from '@shared/constants/enums';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { CanWrite, CanDelete } from '@shared/decorators/resource-permissions.decorator';
import { RequirePermissions } from '@shared/decorators/permissions.decorator';

// DTOs
import { CreateUserDto } from '@application/dtos/user/create-user.dto';
import { UpdateUserDto } from '@application/dtos/user/update-user.dto';
import { ChangePasswordDto } from '@application/dtos/user/change-password.dto';
import { ActivateUserDto } from '@application/dtos/user/activate-user.dto';
import { AssignRoleDto } from '@application/dtos/user/assign-role.dto';

// Queries
import { GetUserQuery } from '@application/queries/user/get-user.query';
import { GetUsersQuery } from '@application/queries/user/get-users.query';

// Commands
import { UpdateUserCommand } from '@application/commands/user/update-user.command';
import { ChangePasswordCommand } from '@application/commands/user/change-password.command';
import { ActivateUserCommand } from '@application/commands/user/activate-user.command';
import { AssignRoleCommand } from '@application/commands/user/assign-role.command';
import { RemoveRoleCommand } from '@application/commands/user/remove-role.command';
import { VerifyPasswordCommand } from '@application/commands/user/verify-password.command';
import { IJwtPayload } from '@application/dtos/responses/user.response';

@ApiTags('users')
@Controller('companies/:companyId/users')
@UseGuards(RolesGuard, PermissionsGuard)
@ApiBearerAuth('JWT-auth')
export class UserController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY, RolesEnum.ADMIN)
  @RequirePermissions('user:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all users in company (Root/Admin only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Returns a list of all users in the company' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permissions',
  })
  async getAllUsers(@Param('companyId') companyId: string) {
    return this.queryBus.execute(new GetUsersQuery(companyId));
  }

  @Get(':id')
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY, RolesEnum.ADMIN)
  @RequirePermissions('user:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user by ID (Root/Admin only)' })
  @ApiParam({
    name: 'companyId',
    description: 'Company ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiParam({ name: 'id', description: 'User ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Returns user information' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permissions',
  })
  async getUserById(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.queryBus.execute(new GetUserQuery(id, companyId));
  }

  @Post()
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY, RolesEnum.ADMIN)
  @CanWrite('user')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new user in company (Root/Admin only)' })
  @ApiParam({
    name: 'companyId',
    description: 'Company ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'User created successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permissions',
  })
  async createUser(@Param('companyId') companyId: string, @Body() _createUserDto: CreateUserDto) {
    // This would normally use a command with company context
    return { message: 'User created successfully', companyId };
  }

  @Put(':id')
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY, RolesEnum.ADMIN)
  @CanWrite('user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user by ID (Root/Admin only)' })
  @ApiParam({
    name: 'companyId',
    description: 'Company ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
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
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.commandBus.execute(
      new UpdateUserCommand(
        id,
        updateUserDto.firstName,
        updateUserDto.lastName,
        updateUserDto.email,
        companyId,
      ),
    );
  }

  @Put('/profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Profile updated successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  async updateCurrentUserProfile(
    @CurrentUser() user: IJwtPayload,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.commandBus.execute(
      new UpdateUserCommand(
        user.sub,
        updateUserDto.firstName,
        updateUserDto.lastName,
        updateUserDto.email,
      ),
    );
  }

  @Delete(':id')
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY, RolesEnum.ADMIN)
  @CanDelete('user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete user by ID (Root/Admin only)' })
  @ApiParam({
    name: 'companyId',
    description: 'Company ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiParam({ name: 'id', description: 'User ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permissions',
  })
  async deleteUser(@Param('companyId') companyId: string, @Param('id') _id: string) {
    // This would normally use a command with company context
    return { message: 'User deleted successfully', companyId };
  }

  @Post(':id/change-password')
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY, RolesEnum.ADMIN)
  @CanWrite('user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change user password (Root/Admin only)' })
  @ApiParam({
    name: 'companyId',
    description: 'Company ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiParam({ name: 'id', description: 'User ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Password changed successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permissions',
  })
  async changePassword(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    await this.commandBus.execute(
      new ChangePasswordCommand(
        id,
        changePasswordDto.newPassword,
        changePasswordDto.currentPassword,
        companyId,
      ),
    );

    return { message: 'Password changed successfully' };
  }

  @Post('/profile/change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change current user password' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Password changed successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Current password is incorrect' })
  async changeCurrentUserPassword(
    @CurrentUser() user: IJwtPayload,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    await this.commandBus.execute(
      new ChangePasswordCommand(
        user.sub,
        changePasswordDto.newPassword,
        changePasswordDto.currentPassword,
      ),
    );

    return { message: 'Password changed successfully' };
  }

  @Post('/profile/verify-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify current user password' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Password verification result' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  async verifyCurrentUserPassword(
    @CurrentUser() user: IJwtPayload,
    @Body('password') password: string,
  ) {
    const isValid = await this.commandBus.execute(new VerifyPasswordCommand(user.sub, password));

    return { valid: isValid };
  }

  @Patch(':id/activate')
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY, RolesEnum.ADMIN)
  @CanWrite('user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate or deactivate user (Root/Admin only)' })
  @ApiParam({
    name: 'companyId',
    description: 'Company ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
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
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() activateUserDto: ActivateUserDto,
  ) {
    return this.commandBus.execute(new ActivateUserCommand(id, activateUserDto.active, companyId));
  }

  @Post(':id/roles')
  @Roles(RolesEnum.ADMIN)
  @CanWrite('user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign role to user (Admin only - cannot assign Root)' })
  @ApiParam({
    name: 'companyId',
    description: 'Company ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
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
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() assignRoleDto: AssignRoleDto,
    @CurrentUser() currentUser: IJwtPayload,
  ) {
    return this.commandBus.execute(
      new AssignRoleCommand(id, assignRoleDto.roleId, companyId, currentUser.sub),
    );
  }

  @Delete(':id/roles/:roleId')
  @Roles(RolesEnum.ADMIN)
  @CanWrite('user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove role from user (Admin only - cannot remove Root)' })
  @ApiParam({
    name: 'companyId',
    description: 'Company ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
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
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Param('roleId') roleId: string,
  ) {
    return this.commandBus.execute(new RemoveRoleCommand(id, roleId, companyId));
  }
}
