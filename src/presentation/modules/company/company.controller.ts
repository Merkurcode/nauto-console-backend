/* eslint-disable prettier/prettier */
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
  ParseUUIDPipe,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { TrimStringPipe } from '@shared/pipes/trim-string.pipe';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { TransactionService } from '@infrastructure/database/prisma/transaction.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { CreateCompanyDto } from '@application/dtos/company/create-company.dto';
import { UpdateCompanyDto } from '@application/dtos/company/update-company.dto';
import { ICompanyResponse } from '@application/dtos/_responses/company/company.response';
import { CompanySwaggerDto } from '@application/dtos/_responses/company/company.swagger.dto';
import { CreateCompanyCommand } from '@application/commands/company/create-company.command';
import { UpdateCompanyCommand } from '@application/commands/company/update-company.command';
import { DeleteCompanyCommand } from '@application/commands/company/delete-company.command';
import { GetCompanyQuery } from '@application/queries/company/get-company.query';
import { GetCompaniesQuery } from '@application/queries/company/get-companies.query';
import { GetCompanyByHostQuery } from '@application/queries/company/get-company-by-host.query';
import { GetCompanySubsidiariesQuery } from '@application/queries/company/get-company-subsidiaries.query';
import { GetRootCompaniesQuery } from '@application/queries/company/get-root-companies.query';
import { GetCompanyHierarchyQuery } from '@application/queries/company/get-company-hierarchy.query';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { Host } from '@core/value-objects/host.vo';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '@presentation/guards/permissions.guard';
import { RolesGuard } from '@presentation/guards/roles.guard';
import { RootReadOnlyGuard } from '@presentation/guards/root-readonly.guard';
import { RequirePermissions } from '@shared/decorators/permissions.decorator';
import { WriteOperation, DeleteOperation } from '@shared/decorators/write-operation.decorator';
import { Roles } from '@shared/decorators/roles.decorator';
import { RolesEnum } from '@shared/constants/enums';
import { Public } from '@shared/decorators/public.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { NoBots } from '@shared/decorators/bot-restrictions.decorator';

@ApiTags('companies')
@Controller('companies')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, RootReadOnlyGuard)
export class CompanyController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
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
  @ApiOperation({
    summary: 'Get companies',
    description: 'Root users can see all companies, other users can only see their own company\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">company:read</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any Authenticated User</code>\n\n' +
      '🔍 **Response includes:** Company details, address with Google Maps URL, AI assistants with features, weekly schedules, and active AI persona',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of companies with complete information including assistants, schedules, and AI persona',
    type: [CompanySwaggerDto],
  })
  @RequirePermissions('company:read')
  async getCompanies(@CurrentUser() currentUserPayload: IJwtPayload): Promise<ICompanyResponse[]> {
    // Delegate all business logic to query handler
    return this.queryBus.execute(new GetCompaniesQuery(currentUserPayload.sub, currentUserPayload.tenantId));
  }

  //@Get('by-host/:host')
  //@Public()
  //@Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY, RolesEnum.BOT)
  //@ApiOperation({
  //  summary: 'Get company by host (Public)',
  //  description:
  //    'Public endpoint to get company information by host/subdomain without authentication. Used for tenant resolution before user login.\n\n' +
  //    '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">None (Public)</code>\n\n' +
  //    '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Public Endpoint</code>\n\n' +
  //    '🔍 **Response includes:** Complete company details, address with Google Maps URL, AI assistants with features, weekly schedules, and active AI persona',
  //})
  //@ApiResponse({
  //  status: HttpStatus.OK,
  //  description: 'Company retrieved successfully with complete information including assistants, schedules, and AI persona',
  //  type: CompanySwaggerDto,
  //})
  //@ApiResponse({
  //  status: HttpStatus.NOT_FOUND,
  //  description: 'Company not found',
  //})
  //async getCompanyByHost(@Param('host', TrimStringPipe) host: string): Promise<ICompanyResponse> {
  //  const hostVO = new Host(host);
  //
  //  return this.queryBus.execute(new GetCompanyByHostQuery(hostVO));
  //}

  @Get('root-companies')
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY)
  @ApiOperation({
    summary: 'Get root companies (Root only)',
    description: 'Get all companies that have no parent company (root level)\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">company:read</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n' +
      '- <code style="color: #e17055; background: #fab1a0; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT_READONLY</code>\n\n' +
      '🔍 **Response includes:** Company details, address with Google Maps URL, AI assistants with features, weekly schedules, and active AI persona',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Root companies retrieved successfully with complete information including assistants, schedules, and AI persona',
    type: [CompanySwaggerDto],
  })
  @RequirePermissions('company:read')
  async getRootCompanies(): Promise<ICompanyResponse[]> {
    return this.queryBus.execute(new GetRootCompaniesQuery());
  }

  @Get(':id')
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY)
  @ApiOperation({
    summary: 'Get company by ID (Root only)',
    description: 'Get detailed information about a specific company\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">company:read</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n' +
      '- <code style="color: #e17055; background: #fab1a0; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT_READONLY</code>\n\n' +
      '🔍 **Response includes:** Complete company details, address with Google Maps URL, AI assistants with features, weekly schedules, and active AI persona',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Company retrieved successfully with complete information including assistants, schedules, and AI persona',
    type: CompanySwaggerDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Company not found',
  })
  @RequirePermissions('company:read')
  async getCompany(@Param('id', TrimStringPipe, ParseUUIDPipe) id: string): Promise<ICompanyResponse> {
    const companyId = CompanyId.fromString(id);

    return this.queryBus.execute(new GetCompanyQuery(companyId));
  }

  @Post()
  @NoBots()
  @Roles(RolesEnum.ROOT)
  @WriteOperation('company')
  @ApiBody({
    type: CreateCompanyDto,
    description: 'Company creation data with required fields: name, description, host, and address. Optional fields include industry sector, operation channel, timezone, currency, language, and URLs.',
  })
  @ApiOperation({
    summary: 'Create a new company (Root only)',
    description:
      'Creates a new company which will serve as a tenant in the multi-tenant system. The company ID returned will be used as the tenant ID for all multi-tenant operations.\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">company:write</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n\n' +
      '⚠️ **Restrictions:** ROOT_READONLY users cannot perform this operation\n\n' +
      '🔍 **Response includes:** Complete company details, address with Google Maps URL, AI assistants with features, weekly schedules, and active AI persona',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Company created successfully with complete information including assistants, schedules, and AI persona',
    type: CompanySwaggerDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Company name already exists',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation error - check request body format',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have Root role or Root readonly users cannot perform write operations',
  })
  async createCompany(@Body() createCompanyDto: CreateCompanyDto): Promise<ICompanyResponse> {
    return this.executeInTransactionWithContext(async () => {
      const command = new CreateCompanyCommand(createCompanyDto);

      return this.commandBus.execute(command);
    });
  }

  @Put(':id')
  @NoBots()
  @Roles(RolesEnum.ROOT, RolesEnum.ADMIN)
  @WriteOperation('company')
  @ApiBody({
    type: UpdateCompanyDto,
    description: 'Company update data. All fields are optional. Only provided fields will be updated.',
  })
  @ApiOperation({
    summary: 'Update company (Root and Admin)',
    description: 'Root users can update any company, Admin users can only update their own company\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">company:write</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code> - Can update any company\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code> - Can only update their own company\n\n' +
      '⚠️ **Restrictions:** ROOT_READONLY users cannot perform this operation\n\n' +
      '🔍 **Response includes:** Complete company details, address with Google Maps URL, AI assistants with features, weekly schedules, and active AI persona',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Company updated successfully with complete information including assistants, schedules, and AI persona',
    type: CompanySwaggerDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Company not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Company name already exists',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have sufficient permissions or Admin users can only update their own company',
  })
  async updateCompany(
    @Param('id', TrimStringPipe, ParseUUIDPipe) id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
    @CurrentUser() currentUserPayload: IJwtPayload,
  ): Promise<ICompanyResponse> {
    return this.executeInTransactionWithContext(async () => {
      const companyId = CompanyId.fromString(id);

      const command = new UpdateCompanyCommand(
        companyId,
        currentUserPayload.sub,
        updateCompanyDto,
      );

      return this.commandBus.execute(command);
    });
  }

  @Delete(':id')
  @NoBots()
  @Roles(RolesEnum.ROOT)
  @DeleteOperation('company')
  @ApiOperation({
    summary: 'Delete company (Root only)',
    description: 'Delete a company from the system\n\n' +
      '📋 **Required Permission:** <code style="color: #c0392b; background: #fadbd8; padding: 2px 6px; border-radius: 3px; font-weight: bold;">company:delete</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n\n' +
      '⚠️ **Restrictions:** ROOT_READONLY users cannot perform this operation',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Company deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Company not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have Root role or Root readonly users cannot perform write operations',
  })
  async deleteCompany(@Param('id', TrimStringPipe, ParseUUIDPipe) id: string): Promise<void> {
    await this.executeInTransactionWithContext(async () => {
      const companyId = CompanyId.fromString(id);

      return this.commandBus.execute(new DeleteCompanyCommand(companyId));
    });
  }

  @Get(':id/subsidiaries')
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY, RolesEnum.ADMIN)
  @ApiOperation({
    summary: 'Get company subsidiaries',
    description: 'Get all direct subsidiaries of a company\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">company:read</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n' +
      '- <code style="color: #e17055; background: #fab1a0; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT_READONLY</code>\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code>\n\n' +
      '🔍 **Response includes:** Company details, address with Google Maps URL, AI assistants with features, weekly schedules, and active AI persona',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Company subsidiaries retrieved successfully with complete information including assistants, schedules, and AI persona',
    type: [CompanySwaggerDto],
  })
  @RequirePermissions('company:read')
  async getCompanySubsidiaries(
    @Param('id', TrimStringPipe, ParseUUIDPipe) id: string,
    @CurrentUser() currentUserPayload: IJwtPayload,
  ): Promise<ICompanyResponse[]> {
    const companyId = CompanyId.fromString(id);

    return this.queryBus.execute(new GetCompanySubsidiariesQuery(companyId, currentUserPayload.sub, currentUserPayload.tenantId));
  }

  @Get(':id/hierarchy')
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY, RolesEnum.ADMIN)
  @ApiOperation({
    summary: 'Get company hierarchy',
    description: 'Get the complete hierarchy tree for a company including all subsidiaries\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">company:read</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n' +
      '- <code style="color: #e17055; background: #fab1a0; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT_READONLY</code>\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code>\n\n' +
      '🔍 **Response includes:** Complete company hierarchy, address with Google Maps URL, AI assistants with features, weekly schedules, and active AI persona',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Company hierarchy retrieved successfully with complete information including assistants, schedules, and AI persona',
    type: CompanySwaggerDto,
  })
  @RequirePermissions('company:read')
  async getCompanyHierarchy(
    @Param('id', TrimStringPipe, ParseUUIDPipe) id: string,
    @CurrentUser() currentUserPayload: IJwtPayload,
  ): Promise<ICompanyResponse> {
    const companyId = CompanyId.fromString(id);

    return this.queryBus.execute(new GetCompanyHierarchyQuery(companyId, currentUserPayload.sub, currentUserPayload.tenantId));
  }
}
