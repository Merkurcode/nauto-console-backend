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
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TransactionService } from '@infrastructure/database/prisma/transaction.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { CreateCompanyDto } from '@application/dtos/company/create-company.dto';
import { UpdateCompanyDto } from '@application/dtos/company/update-company.dto';
import { CompanyResponse } from '@application/dtos/responses/company.response';
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
import { CompanyName } from '@core/value-objects/company-name.vo';
import { CompanyDescription } from '@core/value-objects/company-description.vo';
import { BusinessSector } from '@core/value-objects/business-sector.vo';
import { BusinessUnit } from '@core/value-objects/business-unit.vo';
import { Address } from '@core/value-objects/address.vo';
import { Host } from '@core/value-objects/host.vo';
import { IndustrySector } from '@core/value-objects/industry-sector.value-object';
import { IndustryOperationChannel } from '@core/value-objects/industry-operation-channel.value-object';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '@presentation/guards/permissions.guard';
import { RolesGuard } from '@presentation/guards/roles.guard';
import { RootReadOnlyGuard } from '@presentation/guards/root-readonly.guard';
import { RequirePermissions } from '@shared/decorators/permissions.decorator';
import { WriteOperation, DeleteOperation } from '@shared/decorators/write-operation.decorator';
import { Roles } from '@shared/decorators/roles.decorator';
import { RolesEnum } from '@shared/constants/enums';
import { Public } from '@shared/decorators/public.decorator';

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
    description: 'Root users can see all companies, other users can only see their own company\n\n**Required Permissions:** company:read\n**Required Roles:** Any authenticated user'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of companies retrieved successfully',
    type: [CompanyResponse],
  })
  @RequirePermissions('company:read')
  async getCompanies(@Request() req: { user: { roles: string[]; tenantId?: string } }): Promise<CompanyResponse[]> {
    const user = req.user;
    const isRootUser = user.roles.includes(RolesEnum.ROOT) || user.roles.includes(RolesEnum.ROOT_READONLY);
    
    if (isRootUser) {
      // Root users can see all companies
      return this.queryBus.execute(new GetCompaniesQuery());
    } else {
      // Other users can only see their own company
      if (!user.tenantId) {
        return []; // No company assigned
      }
      const companyId = CompanyId.fromString(user.tenantId);
      const company = await this.queryBus.execute(new GetCompanyQuery(companyId));
      
      return [company];
    }
  }

  @Get('by-host/:host')
  @Public()
  @ApiOperation({
    summary: 'Get company by host (Public)',
    description:
      'Public endpoint to get company information by host/subdomain without authentication. Used for tenant resolution before user login.\n\n**Required Permissions:** None (Public endpoint)\n**Required Roles:** None (Public endpoint)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Company retrieved successfully',
    type: CompanyResponse,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Company not found',
  })
  async getCompanyByHost(@Param('host') host: string): Promise<CompanyResponse> {
    const hostVO = new Host(host);

    return this.queryBus.execute(new GetCompanyByHostQuery(hostVO));
  }

  @Get('root-companies')
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY)
  @ApiOperation({ 
    summary: 'Get root companies', 
    description: 'Get all companies that have no parent company (root level)\n\n**Required Permissions:** company:read\n**Required Roles:** root, root_readonly'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Root companies retrieved successfully',
    type: [CompanyResponse],
  })
  @RequirePermissions('company:read')
  async getRootCompanies(): Promise<CompanyResponse[]> {
    return this.queryBus.execute(new GetRootCompaniesQuery());
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get company by ID (All authenticated users)',
    description: 'Get detailed information about a specific company\n\n**Required Permissions:** company:read\n**Required Roles:** Any authenticated user'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Company retrieved successfully',
    type: CompanyResponse,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Company not found',
  })
  @RequirePermissions('company:read')
  async getCompany(@Param('id', ParseUUIDPipe) id: string): Promise<CompanyResponse> {
    const companyId = CompanyId.fromString(id);

    return this.queryBus.execute(new GetCompanyQuery(companyId));
  }

  @Post()
  @Roles(RolesEnum.ROOT)
  @WriteOperation('company')
  @ApiOperation({
    summary: 'Create a new company (Root only)',
    description:
      'Creates a new company which will serve as a tenant in the multi-tenant system. The company ID returned will be used as the tenant ID for all multi-tenant operations.\n\n**Required Permissions:** company:write\n**Required Roles:** root\n**Restrictions:** Root readonly users cannot perform this operation',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Company created successfully',
    type: CompanyResponse,
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
  async createCompany(@Body() createCompanyDto: CreateCompanyDto): Promise<CompanyResponse> {
    return this.executeInTransactionWithContext(async () => {
      const { name, description, businessSector, businessUnit, address, host, timezone, currency, language, logoUrl, websiteUrl, privacyPolicyUrl, industrySector, industryOperationChannel, parentCompanyId } = createCompanyDto;

      const command = new CreateCompanyCommand(
        new CompanyName(name),
        new CompanyDescription(description),
        new BusinessSector(businessSector),
        new BusinessUnit(businessUnit),
        new Address(
          address.country,
          address.state,
          address.city,
          address.street,
          address.exteriorNumber,
          address.postalCode,
          address.interiorNumber,
        ),
        new Host(host),
        timezone,
        currency,
        language,
        logoUrl,
        websiteUrl,
        privacyPolicyUrl,
        industrySector ? IndustrySector.create(industrySector) : undefined,
        industryOperationChannel ? IndustryOperationChannel.create(industryOperationChannel) : undefined,
        parentCompanyId ? CompanyId.fromString(parentCompanyId) : undefined,
      );

      return this.commandBus.execute(command);
    });
  }

  @Put(':id')
  @Roles(RolesEnum.ROOT, RolesEnum.ADMIN)
  @WriteOperation('company')
  @ApiOperation({ 
    summary: 'Update company (Root and Admin)', 
    description: 'Root users can update any company, Admin users can only update their own company\n\n**Required Permissions:** company:write\n**Required Roles:** root, admin\n**Restrictions:** Root readonly users cannot perform this operation. Admin users can only update their own company'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Company updated successfully',
    type: CompanyResponse,
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
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
    @Request() req: { user: { roles: string[]; companyId?: string } },
  ): Promise<CompanyResponse> {
    return this.executeInTransactionWithContext(async () => {
      const companyId = CompanyId.fromString(id);
      const user = req.user;
      
      // Authorization check: Admin users can only update their own company
      const isRootUser = user.roles.includes(RolesEnum.ROOT);
      const isAdminUser = user.roles.includes(RolesEnum.ADMIN);
      
      if (isAdminUser && !isRootUser) {
        // Admin users can only update their own company
        if (!user.companyId || user.companyId !== id) {
          throw new ForbiddenException('Admin users can only update their own company');
        }
      }
      
      const { name, description, businessSector, businessUnit, address, host, timezone, currency, language, logoUrl, websiteUrl, privacyPolicyUrl, industrySector, industryOperationChannel, parentCompanyId } = updateCompanyDto;

      const command = new UpdateCompanyCommand(
        companyId,
        name ? new CompanyName(name) : undefined,
        description ? new CompanyDescription(description) : undefined,
        businessSector ? new BusinessSector(businessSector) : undefined,
        businessUnit ? new BusinessUnit(businessUnit) : undefined,
        address &&
        address.country &&
        address.state &&
        address.city &&
        address.street &&
        address.exteriorNumber &&
        address.postalCode
          ? new Address(
              address.country,
              address.state,
              address.city,
              address.street,
              address.exteriorNumber,
              address.postalCode,
              address.interiorNumber,
            )
          : undefined,
        host ? new Host(host) : undefined,
        timezone,
        currency,
        language,
        logoUrl,
        websiteUrl,
        privacyPolicyUrl,
        industrySector ? IndustrySector.create(industrySector) : undefined,
        industryOperationChannel ? IndustryOperationChannel.create(industryOperationChannel) : undefined,
        parentCompanyId ? CompanyId.fromString(parentCompanyId) : undefined,
      );

      return this.commandBus.execute(command);
    });
  }

  @Delete(':id')
  @Roles(RolesEnum.ROOT)
  @DeleteOperation('company')
  @ApiOperation({ 
    summary: 'Delete company (Root only)',
    description: 'Delete a company from the system\n\n**Required Permissions:** company:delete\n**Required Roles:** root\n**Restrictions:** Root readonly users cannot perform this operation'
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
  async deleteCompany(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.executeInTransactionWithContext(async () => {
      const companyId = CompanyId.fromString(id);
      
return this.commandBus.execute(new DeleteCompanyCommand(companyId));
    });
  }

  @Get(':id/subsidiaries')
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY, RolesEnum.ADMIN)
  @ApiOperation({ 
    summary: 'Get company subsidiaries', 
    description: 'Get all direct subsidiaries of a company\n\n**Required Permissions:** company:read\n**Required Roles:** root, root_readonly, admin'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Company subsidiaries retrieved successfully',
    type: [CompanyResponse],
  })
  @RequirePermissions('company:read')
  async getCompanySubsidiaries(@Param('id', ParseUUIDPipe) id: string): Promise<CompanyResponse[]> {
    const companyId = CompanyId.fromString(id);
    
return this.queryBus.execute(new GetCompanySubsidiariesQuery(companyId));
  }

  @Get(':id/hierarchy')
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY, RolesEnum.ADMIN)
  @ApiOperation({ 
    summary: 'Get company hierarchy', 
    description: 'Get the complete hierarchy tree for a company including all subsidiaries\n\n**Required Permissions:** company:read\n**Required Roles:** root, root_readonly, admin'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Company hierarchy retrieved successfully',
    type: CompanyResponse,
  })
  @RequirePermissions('company:read')
  async getCompanyHierarchy(@Param('id', ParseUUIDPipe) id: string): Promise<CompanyResponse> {
    const companyId = CompanyId.fromString(id);
    
return this.queryBus.execute(new GetCompanyHierarchyQuery(companyId));
  }
}
