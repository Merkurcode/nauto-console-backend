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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CreateCompanyDto } from '@application/dtos/company/create-company.dto';
import { UpdateCompanyDto } from '@application/dtos/company/update-company.dto';
import { CompanyResponse } from '@application/dtos/responses/company.response';
import { CreateCompanyCommand } from '@application/commands/company/create-company.command';
import { UpdateCompanyCommand } from '@application/commands/company/update-company.command';
import { DeleteCompanyCommand } from '@application/commands/company/delete-company.command';
import { GetCompanyQuery } from '@application/queries/company/get-company.query';
import { GetCompaniesQuery } from '@application/queries/company/get-companies.query';
import { GetCompanyByHostQuery } from '@application/queries/company/get-company-by-host.query';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { CompanyName } from '@core/value-objects/company-name.vo';
import { CompanyDescription } from '@core/value-objects/company-description.vo';
import { BusinessSector } from '@core/value-objects/business-sector.vo';
import { BusinessUnit } from '@core/value-objects/business-unit.vo';
import { Address } from '@core/value-objects/address.vo';
import { Host } from '@core/value-objects/host.vo';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '@presentation/guards/permissions.guard';
import { RolesGuard } from '@presentation/guards/roles.guard';
import { RequirePermissions } from '@shared/decorators/permissions.decorator';
import { CanWrite, CanDelete } from '@shared/decorators/resource-permissions.decorator';
import { Roles } from '@shared/decorators/roles.decorator';
import { RolesEnum } from '@shared/constants/enums';
import { Public } from '@shared/decorators/public.decorator';

@ApiTags('companies')
@Controller('companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CompanyController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @Roles(RolesEnum.SUPERADMIN, RolesEnum.ADMIN, RolesEnum.USER)
  @ApiOperation({ summary: 'Get all companies (All authenticated users)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of companies retrieved successfully',
    type: [CompanyResponse],
  })
  @RequirePermissions('company:read')
  async getCompanies(): Promise<CompanyResponse[]> {
    return this.queryBus.execute(new GetCompaniesQuery());
  }

  @Get('by-host/:host')
  @Public()
  @ApiOperation({
    summary: 'Get company by host (Public)',
    description:
      'Public endpoint to get company information by host/subdomain without authentication. Used for tenant resolution before user login.',
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

  @Get(':id')
  @Roles(RolesEnum.SUPERADMIN, RolesEnum.ADMIN, RolesEnum.USER)
  @ApiOperation({ summary: 'Get company by ID (All authenticated users)' })
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
  @Roles(RolesEnum.SUPERADMIN)
  @ApiOperation({
    summary: 'Create a new company (SuperAdmin only)',
    description:
      'Creates a new company which will serve as a tenant in the multi-tenant system. The company ID returned will be used as the tenant ID for all multi-tenant operations.',
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
    description: 'User does not have SuperAdmin role',
  })
  @CanWrite('company')
  async createCompany(@Body() createCompanyDto: CreateCompanyDto): Promise<CompanyResponse> {
    const { name, description, businessSector, businessUnit, address, host } = createCompanyDto;

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
    );

    return this.commandBus.execute(command);
  }

  @Put(':id')
  @Roles(RolesEnum.SUPERADMIN)
  @ApiOperation({ summary: 'Update company (SuperAdmin only)' })
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
    description: 'User does not have SuperAdmin role',
  })
  @CanWrite('company')
  async updateCompany(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
  ): Promise<CompanyResponse> {
    const companyId = CompanyId.fromString(id);
    const { name, description, businessSector, businessUnit, address, host } = updateCompanyDto;

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
    );

    return this.commandBus.execute(command);
  }

  @Delete(':id')
  @Roles(RolesEnum.SUPERADMIN)
  @ApiOperation({ summary: 'Delete company (SuperAdmin only)' })
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
    description: 'User does not have SuperAdmin role',
  })
  @CanDelete('company')
  async deleteCompany(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const companyId = CompanyId.fromString(id);
    await this.commandBus.execute(new DeleteCompanyCommand(companyId));
  }
}
