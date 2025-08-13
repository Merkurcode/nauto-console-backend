import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { RolesGuard } from '@presentation/guards/roles.guard';
import { PermissionsGuard } from '@presentation/guards/permissions.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import {
  CanRead,
  CanWrite,
  CanDelete,
  CanUpdate,
  CanAssign,
} from '@shared/decorators/resource-permissions.decorator';
import { TransactionService } from '@infrastructure/database/prisma/transaction.service';

import { CreateAIPersonaDto } from '@application/dtos/ai-persona/create-ai-persona.dto';
import { UpdateAIPersonaDto } from '@application/dtos/ai-persona/update-ai-persona.dto';
import { AssignAIPersonaDto } from '@application/dtos/ai-persona/assign-ai-persona.dto';
import { UpdateAIPersonaStatusDto } from '@application/dtos/ai-persona/update-ai-persona-status.dto';
import { UpdateCompanyAIPersonaStatusDto } from '@application/dtos/ai-persona/update-company-ai-persona-status.dto';
import { IAIPersonaResponse } from '@application/dtos/_responses/ai-persona/ai-persona.response.interface';
import { IAIPersonaAssignmentResponse } from '@application/dtos/_responses/ai-persona/ai-persona-assignment.response.interface';
import { IAIPersonaDeleteResponse } from '@application/dtos/_responses/ai-persona/ai-persona-delete.response.interface';
import { AIPersonaSwaggerDto } from '@application/dtos/_responses/ai-persona/ai-persona.swagger.dto';
import { AIPersonaAssignmentSwaggerDto } from '@application/dtos/_responses/ai-persona/ai-persona-assignment.swagger.dto';
import { AIPersonaDeleteSwaggerDto } from '@application/dtos/_responses/ai-persona/ai-persona-delete.swagger.dto';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { AIPersonaMapper } from '@application/mappers/ai-persona.mapper';

import { CreateAIPersonaCommand } from '@application/commands/ai-persona/create-ai-persona.command';
import { UpdateAIPersonaCommand } from '@application/commands/ai-persona/update-ai-persona.command';
import { DeleteAIPersonaCommand } from '@application/commands/ai-persona/delete-ai-persona.command';
import { AssignAIPersonaToCompanyCommand } from '@application/commands/ai-persona/assign-ai-persona-to-company.command';
import { UpdateAIPersonaStatusCommand } from '@application/commands/ai-persona/update-ai-persona-status.command';
import { UpdateCompanyAIPersonaStatusCommand } from '@application/commands/ai-persona/update-company-ai-persona-status.command';

import { GetAIPersonaByIdQuery } from '@application/queries/ai-persona/get-ai-persona-by-id.query';
import { GetAllAIPersonasQuery } from '@application/queries/ai-persona/get-all-ai-personas.query';
import { GetCompanyAIPersonasQuery } from '@application/queries/ai-persona/get-company-ai-personas.query';
import { GetCompanyActiveAIPersonaQuery } from '@application/queries/ai-persona/get-company-active-ai-persona.query';
import { NoBots } from '@shared/decorators/bot-restrictions.decorator';
import { Roles } from '@shared/decorators/roles.decorator';
import { RolesEnum } from '@shared/constants/enums';

@ApiTags('ai-personas')
@ApiBearerAuth('JWT-auth')
@Controller('ai-personas')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@NoBots()
export class AIPersonaController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly transactionService: TransactionService,
  ) {}

  @Post(':language')
  @CanWrite('ai-persona')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new AI persona (Root/Admin/Manager)',
    description:
      'Create a new AI persona with custom configuration. Default personas can only be created by Root users. Company-specific personas can be created by Root, Admin, and Manager users.\n\n' +
      '**Behavior by Role:**\n' +
      '- **Root**: Can create default personas and company-specific personas for any company\n' +
      '- **Admin**: Can create company-specific personas for their own company\n' +
      '- **Manager**: Can create company-specific personas for their own company\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ai-persona:write</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code>\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code>\n\n' +
      '⚠️ **Restrictions:** Only Root users can create default personas. Company-specific personas require company access permissions.',
  })
  @ApiParam({
    name: 'language',
    description: 'Language code for the AI persona content (e.g., es-MX, en-US, fr-FR)',
    example: 'es-MX',
  })
  @ApiBody({
    type: CreateAIPersonaDto,
    description:
      'AI persona creation data including name, tone, personality, objective, short details, and optional company assignment',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: AIPersonaSwaggerDto,
    description: 'AI persona created successfully with generated ID and metadata',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data or AI persona key name already exists',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permissions or cannot create default personas',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated',
  })
  async create(
    @Body() dto: CreateAIPersonaDto,
    @Param('language') language: string,
    @CurrentUser() user: IJwtPayload,
  ): Promise<IAIPersonaResponse> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(
        new CreateAIPersonaCommand(
          dto.name,
          dto.tone,
          dto.personality,
          dto.objective,
          dto.shortDetails,
          language,
          dto.isDefault || false,
          dto.companyId || null,
          user.sub,
        ),
      );
    });
  }

  @Get()
  @CanRead('ai-persona')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all AI personas with optional filtering (Any authenticated user)',
    description:
      'Retrieve all AI personas with optional filtering by status, type, and company. Returns only active personas by default unless explicitly requested otherwise.\n\n' +
      '**Behavior by Role:**\n' +
      '- **Root/Root-Readonly**: Can see all personas from all companies\n' +
      '- **Admin/Manager**: Can see personas from their company and default personas\n' +
      '- **Sales Agent/Host/Guest**: Can see default personas and their company personas\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ai-persona:read</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code>\n\n' +
      '⚠️ **Restrictions:** Business rule applies - only active personas returned by default. Company-based filtering enforced automatically.',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by active status. Default: true (only active personas)',
    example: true,
  })
  @ApiQuery({
    name: 'isDefault',
    required: false,
    type: Boolean,
    description: 'Filter by default status. When true, returns system default personas',
    example: false,
  })
  @ApiQuery({
    name: 'companyId',
    required: false,
    type: String,
    description: 'Filter by company ID. Root users can specify any company',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: [AIPersonaSwaggerDto],
    description:
      'Returns array of AI personas matching the filter criteria with company-based access control applied',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permissions',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated',
  })
  async findAll(
    @Query('isActive') isActive?: string,
    @Query('isDefault') isDefault?: string,
    @Query('companyId') companyId?: string,
    @CurrentUser() user?: IJwtPayload,
  ): Promise<IAIPersonaResponse[]> {
    const filters: Record<string, unknown> = {};

    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }

    if (isDefault !== undefined) {
      filters.isDefault = isDefault === 'true';
    }

    if (companyId) {
      filters.companyId = companyId;
    }

    return this.queryBus.execute(new GetAllAIPersonasQuery(filters, user?.sub));
  }

  @Get('company/:companyId')
  @CanRead('ai-persona')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get company-specific AI personas (Company access required)',
    description:
      'Retrieve all AI personas created specifically for a company. This endpoint ONLY returns company-specific personas (companyId field matches), NOT default personas. Only returns active personas.\n\n' +
      '**Important:** This endpoint returns personas where `companyId === {companyId}`. To get default personas, use the main `/api/ai-personas` endpoint with `isDefault=true`.\n\n' +
      '**Behavior by Role:**\n' +
      '- **Root/Root-Readonly**: Can access personas for any company\n' +
      '- **Admin/Manager/Sales Agent/Host/Guest**: Can only access personas for their own company\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ai-persona:read</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code>\n\n' +
      '⚠️ **Restrictions:** Only returns company-owned personas. Company access validation enforced. Returns empty array if user cannot access the specified company.',
  })
  @ApiParam({
    name: 'companyId',
    type: String,
    description: 'Company ID to retrieve company-specific AI personas for',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: [AIPersonaSwaggerDto],
    description:
      'Returns array of company-specific AI personas (ONLY personas created for this specific company, excludes defaults)',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have access to the specified company',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated',
  })
  async findByCompany(
    @Param('companyId') companyId: string,
    @CurrentUser() user: IJwtPayload,
  ): Promise<IAIPersonaResponse[]> {
    return this.queryBus.execute(new GetCompanyAIPersonasQuery(companyId, user.sub));
  }

  @Get('company/:companyId/active')
  @CanRead('ai-persona')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get the currently active AI persona for a company (Company access required)',
    description:
      'Retrieve the currently active AI persona assignment for a specific company. Returns the persona only if both the assignment and the persona are active.\n\n' +
      '**Behavior by Role:**\n' +
      '- **Root/Root-Readonly**: Can access active persona for any company\n' +
      '- **Admin/Manager/Sales Agent/Host/Guest**: Can only access active persona for their own company\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ai-persona:read</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code>\n\n' +
      '⚠️ **Restrictions:** Returns null if no active assignment exists or user cannot access the company.',
  })
  @ApiParam({
    name: 'companyId',
    type: String,
    description: 'Company ID to get the active AI persona for',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: AIPersonaSwaggerDto,
    description:
      'Returns the currently active AI persona for the company, or null if no active assignment exists',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have access to the specified company',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated',
  })
  async getCompanyActivePersona(
    @Param('companyId') companyId: string,
    @CurrentUser() user: IJwtPayload,
  ): Promise<IAIPersonaResponse | null> {
    return this.queryBus.execute(new GetCompanyActiveAIPersonaQuery(companyId, user.sub));
  }

  @Get(':id')
  @CanRead('ai-persona')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get AI persona by ID (Any authenticated user)',
    description:
      'Retrieve detailed information about a specific AI persona by its ID. Returns persona regardless of active status for administrative purposes.\n\n' +
      '**Behavior by Role:**\n' +
      '- **Root/Root-Readonly**: Can access any AI persona by ID\n' +
      '- **Admin/Manager/Sales Agent/Host/Guest**: Can access default personas and their company personas\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ai-persona:read</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code>\n\n' +
      '⚠️ **Restrictions:** Company-based access control applies for company-specific personas.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'AI persona unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: AIPersonaSwaggerDto,
    description: 'Returns detailed AI persona information including configuration and metadata',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'AI persona not found or user does not have access',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permissions',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated',
  })
  async findOne(@Param('id') id: string): Promise<IAIPersonaResponse> {
    return this.queryBus.execute(new GetAIPersonaByIdQuery(id));
  }

  @Put(':id/:language')
  @CanUpdate('ai-persona')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update AI persona configuration (Root/Admin/Manager)',
    description:
      "Update an existing AI persona's configuration including tone, personality, and objective. Default personas can only be modified by Root users.\n\n" +
      '**Behavior by Role:**\n' +
      '- **Root**: Can update any AI persona including default personas\n' +
      '- **Admin/Manager**: Can update company-specific personas from their own company\n\n' +
      '📋 **Required Permission:** <code style="color: #f39c12; background: #fff3cd; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ai-persona:update</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code>\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code>\n\n' +
      '⚠️ **Restrictions:** Default personas require Root access. Company personas require company access permissions.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'AI persona unique identifier to update',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiParam({
    name: 'language',
    description: 'Language code for the AI persona content update (e.g., es-MX, en-US, fr-FR)',
    example: 'es-MX',
  })
  @ApiBody({
    type: UpdateAIPersonaDto,
    description:
      'AI persona update data with new tone, personality, objective, and short details configuration',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: AIPersonaSwaggerDto,
    description: 'AI persona updated successfully with new configuration',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data or validation errors',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'AI persona not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permissions or cannot modify default personas',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated',
  })
  async update(
    @Param('id') id: string,
    @Param('language') language: string,
    @Body() dto: UpdateAIPersonaDto,
    @CurrentUser() user: IJwtPayload,
  ): Promise<IAIPersonaResponse> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(
        new UpdateAIPersonaCommand(
          id,
          dto.tone,
          dto.personality,
          dto.objective,
          dto.shortDetails,
          language,
          user.sub,
        ),
      );
    });
  }

  @Delete(':id')
  @CanDelete('ai-persona')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete AI persona (Root/Admin with restrictions)',
    description:
      'Permanently delete an AI persona from the system. Default personas cannot be deleted. Company-specific personas can be deleted by authorized users.\n\n' +
      '**Behavior by Role:**\n' +
      '- **Root**: Can delete any non-default AI persona\n' +
      '- **Admin**: Can delete company-specific personas from their own company (not default personas)\n\n' +
      '📋 **Required Permission:** <code style="color: #c0392b; background: #fadbd8; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ai-persona:delete</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code>\n\n' +
      '⚠️ **Restrictions:** Default personas cannot be deleted. Company access validation applies.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'AI persona unique identifier to delete',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: AIPersonaDeleteSwaggerDto,
    description: 'AI persona deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'AI persona not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User cannot delete default personas or does not have access to this persona',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated',
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: IJwtPayload,
  ): Promise<IAIPersonaDeleteResponse> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(new DeleteAIPersonaCommand(id, user.sub));
    });
  }

  @Post('company/:companyId/assign')
  @CanAssign('ai-persona')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assign AI persona to company (Root/Admin/Manager)',
    description:
      'Assign an AI persona to a specific company, making it the active persona for that company. Only active personas can be assigned. Previous assignments are replaced.\n\n' +
      '**Behavior by Role:**\n' +
      '- **Root**: Can assign any AI persona to any company\n' +
      '- **Admin/Manager**: Can assign AI personas to their own company only\n\n' +
      '📋 **Required Permission:** <code style="color: #8e44ad; background: #e8daef; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ai-persona:assign</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code>\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code>\n\n' +
      '⚠️ **Restrictions:** AI persona must be active. Company access validation applies.',
  })
  @ApiParam({
    name: 'companyId',
    type: String,
    description: 'Company ID to assign the AI persona to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({
    type: AssignAIPersonaDto,
    description: 'Assignment data containing the AI persona ID to assign to the company',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: AIPersonaAssignmentSwaggerDto,
    description: 'AI persona assigned to company successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid AI persona ID or persona is not active',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'AI persona or company not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have access to assign personas to this company',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated',
  })
  async assignToCompany(
    @Param('companyId') companyId: string,
    @Body() dto: AssignAIPersonaDto,
    @CurrentUser() user: IJwtPayload,
  ): Promise<IAIPersonaAssignmentResponse> {
    return this.transactionService.executeInTransaction(async () => {
      const assignment = await this.commandBus.execute(
        new AssignAIPersonaToCompanyCommand(companyId, dto.aiPersonaId, user.sub),
      );

      return AIPersonaMapper.toAssignmentResponse(assignment);
    });
  }

  @Patch(':id/status')
  @Roles(RolesEnum.ROOT)
  @CanUpdate('ai-persona')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update AI persona active status (Root only)',
    description:
      'Toggle the active status of an AI persona. Only Root users can perform this operation. When a default persona becomes inactive, all company assignments are automatically removed.\n\n' +
      '**Behavior by Role:**\n' +
      '- **Root**: Can activate/deactivate any AI persona\n' +
      '- **Other roles**: No access\n\n' +
      '📋 **Required Permission:** <code style="color: #f39c12; background: #fff3cd; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ai-persona:update</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n\n' +
      '⚠️ **Business Rule:** When default persona becomes inactive, all company assignments are removed automatically.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'AI persona unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({
    type: UpdateAIPersonaStatusDto,
    description: 'New active status for the AI persona',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: AIPersonaSwaggerDto,
    description: 'AI persona status updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'AI persona not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Only Root users can update AI persona status',
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAIPersonaStatusDto,
    @CurrentUser() user: IJwtPayload,
  ): Promise<IAIPersonaResponse> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(new UpdateAIPersonaStatusCommand(id, dto.isActive, user.sub));
    });
  }

  @Patch('company/:companyId/assignment/status')
  @CanUpdate('ai-persona')
  @CanAssign('ai-persona')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update or create company AI persona assignment with status (Root/Admin/Manager)',
    description:
      "Update the active status of a company's AI persona assignment. If no assignment exists, it creates one. If a different persona is specified, it replaces the current assignment.\n\n" +
      '**Behavior by Role:**\n' +
      '- **Root**: Can update assignment status for any company\n' +
      '- **Admin/Manager**: Can update assignment status for their own company\n\n' +
      '📋 **Required Permissions:**\n' +
      '- <code style="color: #f39c12; background: #fff3cd; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ai-persona:update</code>\n' +
      '- <code style="color: #8e44ad; background: #e8daef; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ai-persona:assign</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code>\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code>\n\n' +
      '⚠️ **Restrictions:** AI Persona must exist. Cannot activate assignment for inactive personas. Company access validation applies.',
  })
  @ApiParam({
    name: 'companyId',
    type: String,
    description: 'Company ID to update the assignment for',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({
    type: UpdateCompanyAIPersonaStatusDto,
    description: 'AI Persona ID and active status for the assignment',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: AIPersonaAssignmentSwaggerDto,
    description: 'Assignment status updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'AI persona not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have access to update assignments for this company',
  })
  async updateCompanyAssignmentStatus(
    @Param('companyId') companyId: string,
    @Body() dto: UpdateCompanyAIPersonaStatusDto,
    @CurrentUser() user: IJwtPayload,
  ): Promise<IAIPersonaAssignmentResponse> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(
        new UpdateCompanyAIPersonaStatusCommand(companyId, dto.aiPersonaId, dto.isActive, user.sub),
      );
    });
  }
}
