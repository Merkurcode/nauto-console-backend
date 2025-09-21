import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { TrimStringPipe } from '@shared/pipes/trim-string.pipe';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import {
  IJwtPayload,
  IAuthRefreshTokenResponse,
} from '@application/dtos/_responses/user/user.response';
import { TransactionService } from '@infrastructure/database/prisma/transaction.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { AssignUserToCompanyDto } from '@application/dtos/company/assign-user-to-company.dto';
import { SwitchCompanyDto } from '@application/dtos/company/switch-company.dto';
import { AssignUserToCompanyCommand } from '@application/commands/company/assign-user-to-company.command';
import { RemoveUserFromCompanyCommand } from '@application/commands/company/remove-user-from-company.command';
import { SwitchCompanyCommand } from '@application/commands/company/switch-company.command';
import { ExitCompanyCommand } from '@application/commands/company/exit-company.command';
import { UserId } from '@core/value-objects/user-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '@presentation/guards/permissions.guard';
import { RootReadOnlyGuard } from '@presentation/guards/root-readonly.guard';
import { RequirePermissions } from '@shared/decorators/permissions.decorator';
import { WriteOperation, DeleteOperation } from '@shared/decorators/write-operation.decorator';
import { RolesGuard } from '@presentation/guards/roles.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { RolesEnum } from '@shared/constants/enums';
import { NoBots } from '@shared/decorators/bot-restrictions.decorator';
import { InvalidSessionException } from '@core/exceptions/domain-exceptions';

@ApiTags('company-users')
@Controller('companies/users')
@NoBots()
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, RootReadOnlyGuard)
export class CompanyUsersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly transactionService: TransactionService,
    private readonly transactionContext: TransactionContextService,
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

  @Post('assign')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('company-user:assign')
  @WriteOperation('company-user')
  @ApiOperation({
    summary: 'Assign user to company',
    description:
      'Assigns a user to a specific company.\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">company-user:assign</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code> - Can assign users to any company\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code> - Can assign users to their company/subsidiaries\n\n' +
      '🛡️ **Security:** Hierarchical restrictions - must have sufficient level to manage target user\n\n' +
      '⚠️ **Restrictions:** ROOT_READONLY users cannot perform this operation',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User assigned to company successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User or Company not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'User does not have company-user:assign permission, insufficient hierarchy level, admin trying to assign to unauthorized company, or Root readonly users cannot perform write operations',
  })
  async assignUserToCompany(
    @Body() assignUserDto: AssignUserToCompanyDto,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<{ message: string }> {
    await this.executeInTransactionWithContext(async () => {
      const userId = UserId.fromString(assignUserDto.userId);
      const companyId = CompanyId.fromString(assignUserDto.companyId);
      const currentUserId = UserId.fromString(currentUser.sub);

      return this.commandBus.execute(
        new AssignUserToCompanyCommand(userId, companyId, currentUserId),
      );
    });

    return { message: 'User assigned to company successfully' };
  }

  @Delete(':userId/company')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('company-user:remove')
  @DeleteOperation('company-user')
  @ApiOperation({
    summary: 'Remove user from company',
    description:
      'Removes a user from their current company assignment.\n\n' +
      '📋 **Required Permission:** <code style="color: #c0392b; background: #fadbd8; padding: 2px 6px; border-radius: 3px; font-weight: bold;">company-user:remove</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code> - Can remove users from any company\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code> - Can remove users from their company/subsidiaries\n\n' +
      '🛡️ **Security:** Users must have sufficient hierarchy level to manage the target user\n\n' +
      '⚠️ **Restrictions:** ROOT_READONLY users cannot perform this operation',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'User removed from company successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'User does not have company-user:remove permission, insufficient hierarchy level, admin trying to remove from unauthorized company, or Root readonly users cannot perform write operations',
  })
  async removeUserFromCompany(
    @Param('userId', TrimStringPipe, ParseUUIDPipe) userId: string,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<void> {
    await this.executeInTransactionWithContext(async () => {
      const userIdVO = UserId.fromString(userId);
      const currentUserId = UserId.fromString(currentUser.sub);

      return this.commandBus.execute(new RemoveUserFromCompanyCommand(userIdVO, currentUserId));
    });
  }

  @Post('switch')
  @HttpCode(HttpStatus.OK)
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY)
  @ApiOperation({
    summary: 'Switch user company (ROOT only)',
    description:
      'Allows ROOT or ROOT_READONLY users to switch their current company context.\n\n' +
      '📋 **Required Role:** <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code> or <code style="color: #e17055; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT_READONLY</code>\n\n' +
      '🔄 **Process:**\n' +
      '1. Validates the user has ROOT or ROOT_READONLY role\n' +
      "2. Updates the user's companyId to the new company\n" +
      '3. Refreshes the authentication tokens with the new company context\n' +
      '4. Returns new access and refresh tokens\n\n' +
      '⚠️ **Important:** Only the authenticated user can switch their own company context',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Company switched successfully. Returns new access and refresh tokens.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have ROOT or ROOT_READONLY role',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Company not found or session not found',
  })
  async switchCompany(
    @Body() switchCompanyDto: SwitchCompanyDto,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<IAuthRefreshTokenResponse> {
    return this.executeInTransactionWithContext(async () => {
      const userId = UserId.fromString(currentUser.sub);
      const companyId = CompanyId.fromString(switchCompanyDto.companyId);
      const sessionToken = currentUser.jti; // JWT ID is the session token

      if (!sessionToken) {
        throw new InvalidSessionException('Session token not found in JWT');
      }

      return this.commandBus.execute(new SwitchCompanyCommand(userId, companyId, sessionToken));
    });
  }

  @Post('exit')
  @HttpCode(HttpStatus.OK)
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY)
  @ApiOperation({
    summary: 'Exit company context (ROOT only)',
    description:
      'Allows ROOT or ROOT_READONLY users to exit their current company context by setting companyId to null.\n\n' +
      '📋 **Required Role:** <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code> or <code style="color: #e17055; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT_READONLY</code>\n\n' +
      '🔄 **Process:**\n' +
      '1. Validates the user has ROOT or ROOT_READONLY role\n' +
      '2. Removes the user from company context (sets companyId to null)\n' +
      '3. Revokes current authentication tokens\n' +
      '4. Generates new access and refresh tokens without company context\n\n' +
      '⚠️ **Important:** Only the authenticated user can exit their own company context',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully exited company context. Returns new access and refresh tokens.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have ROOT or ROOT_READONLY role',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Session not found',
  })
  async exitCompany(@CurrentUser() currentUser: IJwtPayload): Promise<IAuthRefreshTokenResponse> {
    return this.executeInTransactionWithContext(async () => {
      const userId = UserId.fromString(currentUser.sub);
      const sessionToken = currentUser.jti; // JWT ID is the session token

      if (!sessionToken) {
        throw new InvalidSessionException('Session token not found in JWT');
      }

      return this.commandBus.execute(new ExitCompanyCommand(userId, sessionToken));
    });
  }
}
