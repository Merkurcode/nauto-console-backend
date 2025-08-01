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
import { AssignUserToCompanyDto } from '@application/dtos/company/assign-user-to-company.dto';
import { AssignUserToCompanyCommand } from '@application/commands/company/assign-user-to-company.command';
import { RemoveUserFromCompanyCommand } from '@application/commands/company/remove-user-from-company.command';
import { UserId } from '@core/value-objects/user-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '@presentation/guards/permissions.guard';
import { RolesGuard } from '@presentation/guards/roles.guard';
import { RootReadOnlyGuard } from '@presentation/guards/root-readonly.guard';
import { RequirePermissions } from '@shared/decorators/permissions.decorator';
import { WriteOperation, DeleteOperation } from '@shared/decorators/write-operation.decorator';
import { Roles } from '@shared/decorators/roles.decorator';
import { RolesEnum } from '@shared/constants/enums';

@ApiTags('company-users')
@Controller('companies/users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, RootReadOnlyGuard)
export class CompanyUsersController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('assign')
  @Roles(RolesEnum.ROOT)
  @WriteOperation('company')
  @ApiOperation({
    summary: 'Assign user to company (Root only)',
    description:
      'Assigns a user to a specific company. Only available to root users.\n\n**Required Permissions:** user:write, company:write\n**Required Roles:** root\n**Restrictions:** Root readonly users cannot perform this operation',
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
      'User does not have Root role or Root readonly users cannot perform write operations',
  })
  @RequirePermissions('user:write', 'company:write')
  async assignUserToCompany(
    @Body() assignUserDto: AssignUserToCompanyDto,
  ): Promise<{ message: string }> {
    const userId = UserId.fromString(assignUserDto.userId);
    const companyId = CompanyId.fromString(assignUserDto.companyId);

    await this.commandBus.execute(new AssignUserToCompanyCommand(userId, companyId));

    return { message: 'User assigned to company successfully' };
  }

  @Delete(':userId/company')
  @Roles(RolesEnum.ROOT)
  @DeleteOperation('company')
  @ApiOperation({
    summary: 'Remove user from company (Root only)',
    description:
      'Removes a user from their current company assignment. Only available to root users.\n\n**Required Permissions:** user:delete, company:write\n**Required Roles:** root\n**Restrictions:** Root readonly users cannot perform this operation',
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
      'User does not have Root role or Root readonly users cannot perform write operations',
  })
  @RequirePermissions('user:write', 'company:write')
  async removeUserFromCompany(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<{ message: string }> {
    const userIdVO = UserId.fromString(userId);

    await this.commandBus.execute(new RemoveUserFromCompanyCommand(userIdVO));

    return { message: 'User removed from company successfully' };
  }
}
