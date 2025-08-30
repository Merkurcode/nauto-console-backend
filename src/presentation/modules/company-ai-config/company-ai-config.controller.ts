import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { RolesGuard } from '@presentation/guards/roles.guard';
import { PermissionsGuard } from '@presentation/guards/permissions.guard';
import { RootReadOnlyGuard } from '@presentation/guards/root-readonly.guard';
import { CompanyAssignmentGuard } from '@presentation/guards/company-assignment.guard';
import { TransactionWithContextService } from '@infrastructure/database/prisma/transaction-with-context.service';
import { TrimStringPipe } from '@shared/pipes/trim-string.pipe';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { RequirePermissions } from '@shared/decorators/permissions.decorator';
import { WriteOperation, DeleteOperation } from '@shared/decorators/write-operation.decorator';
import { CreateCompanyAIConfigDto } from '@application/dtos/company-ai-config/create-company-ai-config.dto';
import { UpdateCompanyAIConfigDto } from '@application/dtos/company-ai-config/update-company-ai-config.dto';
import { CompanyAIConfigResponseDto } from '@application/dtos/_responses/company-ai-config/company-ai-config.swagger.dto';
import { ICompanyAIConfigResponse } from '@application/dtos/_responses/company-ai-config/company-ai-config.response.interface';
import { CreateCompanyAIConfigCommand } from '@application/commands/company-ai-config/create-company-ai-config.command';
import { UpdateCompanyAIConfigCommand } from '@application/commands/company-ai-config/update-company-ai-config.command';
import { DeleteCompanyAIConfigCommand } from '@application/commands/company-ai-config/delete-company-ai-config.command';
import { GetCompanyAIConfigQuery } from '@application/queries/company-ai-config/get-company-ai-config.query';

/**
 * Company AI Configuration Controller
 * Following Clean Architecture: Presentation layer handling HTTP concerns
 * All write operations are wrapped in database transactions
 */
@ApiTags('company-ai-configuration')
@Controller('api/companies/:companyId/ai-config')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, RootReadOnlyGuard, CompanyAssignmentGuard)
export class CompanyAIConfigController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly transactionWithContextService: TransactionWithContextService,
  ) {}

  @Get()
  @RequirePermissions('company-ai-config:read')
  @ApiOperation({
    summary: 'Get company AI configuration',
    description:
      'Retrieves the AI configuration settings for the specified company.\n\n' +
      '📋 **Required Permission:** <code style=\"color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;\">company-ai-config:read</code>\n\n' +
      '👥 **Roles with Access:** ROOT, ROOT_READONLY, ADMIN (with company access)\n\n' +
      '🛡️ **Security:** Company assignment guard ensures access only to assigned companies',
  })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Company AI configuration retrieved successfully',
    type: CompanyAIConfigResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Company not found or AI configuration not set',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have company-ai-config:read permission or access to this company',
  })
  async getAIConfig(
    @Param('companyId', TrimStringPipe, ParseUUIDPipe) companyId: string,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<ICompanyAIConfigResponse> {
    return await this.queryBus.execute(new GetCompanyAIConfigQuery(companyId, currentUser));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('company-ai-config:write')
  @WriteOperation('company-ai-config')
  @ApiOperation({
    summary: 'Create company AI configuration',
    description:
      'Creates AI configuration settings for the specified company.\n\n' +
      '📋 **Required Permission:** <code style=\"color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;\">company-ai-config:create</code>\n\n' +
      '👥 **Roles with Access:** ROOT, ADMIN (with company access)\n\n' +
      '🛡️ **Security:** Company assignment guard ensures access only to assigned companies\n\n' +
      '⚠️ **Restrictions:** ROOT_READONLY users cannot perform this operation',
  })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Company AI configuration created successfully',
    type: CompanyAIConfigResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Company not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid configuration data',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'User does not have company-ai-config:create permission, access to this company, or ROOT_READONLY users cannot perform write operations',
  })
  async createAIConfig(
    @Param('companyId', TrimStringPipe, ParseUUIDPipe) companyId: string,
    @Body() createConfigDto: CreateCompanyAIConfigDto,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<ICompanyAIConfigResponse> {
    return this.transactionWithContextService.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(
        new CreateCompanyAIConfigCommand(companyId, createConfigDto, currentUser),
      );
    });
  }

  @Put()
  @RequirePermissions('company-ai-config:write')
  @WriteOperation('company-ai-config')
  @ApiOperation({
    summary: 'Update company AI configuration',
    description:
      'PUT operation replaces the entire AI configuration with provided data.\n\n' +
      '📋 **Required Permission:** <code style=\"color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;\">company-ai-config:update</code>\n\n' +
      '👥 **Roles with Access:** ROOT, ADMIN (with company access)\n\n' +
      '🛡️ **Security:** Company assignment guard ensures access only to assigned companies\n\n' +
      '⚠️ **Restrictions:** ROOT_READONLY users cannot perform this operation',
  })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Company AI configuration updated successfully',
    type: CompanyAIConfigResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Company not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid configuration data',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'User does not have company-ai-config:update permission, access to this company, or ROOT_READONLY users cannot perform write operations',
  })
  async updateAIConfig(
    @Param('companyId', TrimStringPipe, ParseUUIDPipe) companyId: string,
    @Body() updateConfigDto: UpdateCompanyAIConfigDto,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<ICompanyAIConfigResponse> {
    return this.transactionWithContextService.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(
        new UpdateCompanyAIConfigCommand(companyId, updateConfigDto, currentUser),
      );
    });
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('company-ai-config:delete')
  @DeleteOperation('company-ai-config')
  @ApiOperation({
    summary: 'Delete company AI configuration',
    description:
      'Removes the AI configuration settings for the specified company.\n\n' +
      '📋 **Required Permission:** <code style=\"color: #c0392b; background: #fadbd8; padding: 2px 6px; border-radius: 3px; font-weight: bold;\">company-ai-config:delete</code>\n\n' +
      '👥 **Roles with Access:** ROOT, ADMIN (with company access)\n\n' +
      '🛡️ **Security:** Company assignment guard ensures access only to assigned companies\n\n' +
      '⚠️ **Restrictions:** ROOT_READONLY users cannot perform this operation',
  })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Company AI configuration deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Company not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'User does not have company-ai-config:delete permission, access to this company, or ROOT_READONLY users cannot perform write operations',
  })
  async deleteAIConfig(
    @Param('companyId', TrimStringPipe, ParseUUIDPipe) companyId: string,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<void> {
    return this.transactionWithContextService.executeInTransactionWithContext(async () => {
      await this.commandBus.execute(new DeleteCompanyAIConfigCommand(companyId, currentUser));
    });
  }
}
