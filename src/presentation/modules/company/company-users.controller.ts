import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { IJwtPayload } from '@application/dtos/responses/user.response';
import { TransactionService } from '@infrastructure/database/prisma/transaction.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { AssignUserToCompanyDto } from '@application/dtos/company/assign-user-to-company.dto';
import { AssignUserToCompanyCommand } from '@application/commands/company/assign-user-to-company.command';
import { RemoveUserFromCompanyCommand } from '@application/commands/company/remove-user-from-company.command';
import { UserId } from '@core/value-objects/user-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '@presentation/guards/permissions.guard';
import { RootReadOnlyGuard } from '@presentation/guards/root-readonly.guard';
import { RequirePermissions } from '@shared/decorators/permissions.decorator';
import { WriteOperation, DeleteOperation } from '@shared/decorators/write-operation.decorator';

@ApiTags('company-users')
@Controller('companies/users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard, RootReadOnlyGuard)
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
  @RequirePermissions('company-user:assign')
  @WriteOperation('company-user')
  @ApiOperation({
    summary: 'Assign user to company',
    description:
      'Assigns a user to a specific company.\n\n**Required Permissions:** company-user:assign\n**Access Control:** Permission-based authorization\n**Restrictions:** Root readonly users cannot perform this operation',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User assigned to company successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User or Company not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'User does not have company-user:assign permission or Root readonly users cannot perform write operations',
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
  @RequirePermissions('company-user:remove')
  @DeleteOperation('company-user')
  @ApiOperation({
    summary: 'Remove user from company',
    description:
      'Removes a user from their current company assignment.\n\n**Required Permissions:** company-user:remove\n**Access Control:** Permission-based authorization\n**Restrictions:** Root readonly users cannot perform this operation',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User removed from company successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'User does not have company-user:remove permission or Root readonly users cannot perform write operations',
  })
  async removeUserFromCompany(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<{ message: string }> {
    await this.executeInTransactionWithContext(async () => {
      const userIdVO = UserId.fromString(userId);
      const currentUserId = UserId.fromString(currentUser.sub);

      return this.commandBus.execute(new RemoveUserFromCompanyCommand(userIdVO, currentUserId));
    });

    return { message: 'User removed from company successfully' };
  }
}
