import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

// Guards & Decorators
import { RolesGuard } from '@presentation/guards/roles.guard';
import { PermissionsGuard } from '@presentation/guards/permissions.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { CanRead, CanWrite, CanDelete } from '@shared/decorators/resource-permissions.decorator';

// Transaction Support
import { TransactionService } from '@infrastructure/database/prisma/transaction.service';

// DTOs
import { CreateCompanyEventDto } from '@application/dtos/company-events-catalog/create-company-event.dto';
import { UpdateCompanyEventDto } from '@application/dtos/company-events-catalog/update-company-event.dto';
import {
  CompanyEventResponseDto,
  CompanyEventsListResponseDto,
} from '@application/dtos/company-events-catalog/company-event-response.dto';

// Mapper
import { CompanyEventsCatalogMapper } from '@application/mappers/company-events-catalog.mapper';

// JWT Payload
import { IJwtPayload } from '@application/dtos/responses/user.response';

@ApiTags('company-events-catalog')
@Controller('companies/:companyId/events-catalog')
@UseGuards(RolesGuard, PermissionsGuard)
@ApiBearerAuth('JWT-auth')
export class CompanyEventsCatalogController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly transactionService: TransactionService,
    private readonly mapper: CompanyEventsCatalogMapper,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CanWrite('company_events')
  @ApiOperation({
    summary: 'Create a new company event catalog entry',
    description:
      'Creates a new event template in the company catalog. Events can be online, physical, or appointment-based.\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">company_events:write</code>\n\n' +
      '👥 **Roles with Write Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code> - Full system access, can create events for any company\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code> - Company administrator, can only create events for their assigned company\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code> - Department manager, can only create events for their assigned company\n\n' +
      '**Company Access Rules:**\n' +
      '- ROOT users bypass company validation and can create events for any company\n' +
      '- All other roles are restricted to their assigned company (companyId must match user.companyId)\n' +
      '- Attempting to create events for another company will result in 403 Forbidden\n\n' +
      '**Event Name Normalization:**\n' +
      '- Event names are automatically normalized (lowercase, remove accents, tabs, line breaks)\n' +
      '- Spaces are replaced with underscores: "Team Meeting" → "team_meeting"\n' +
      '- Accents are removed: "Reunión" → "reunion"',
  })
  @ApiParam({
    name: 'companyId',
    description: 'Unique identifier of the company to create event for',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      'Event catalog entry created successfully with standardized event name and all details',
    type: CompanyEventResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Invalid input data - check required fields, duration format, pricing values, or boolean flags',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'Event name already exists - event names are standardized and must be unique within the company',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions - requires company_events:write permission',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Company not found or user does not have access to this company',
  })
  async createEvent(
    @Param('companyId') companyId: string,
    @Body() createEventDto: CreateCompanyEventDto,
    @CurrentUser() user: IJwtPayload,
  ): Promise<CompanyEventResponseDto> {
    return this.transactionService.executeInTransaction(async () => {
      const command = this.mapper.toCreateCommand(createEventDto, companyId, user.sub);
      const result = await this.commandBus.execute(command);

      return this.mapper.toCreateResponseDto(result);
    });
  }

  @Get()
  @CanRead('company_events')
  @ApiOperation({
    summary: 'Get all company event catalog entries',
    description:
      'Retrieves a paginated list of all events in the company catalog with filtering options.\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">company_events:read</code>\n\n' +
      '👥 **Roles with Read Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code> - Can view events for any company\n' +
      '- <code style="color: #e17055; background: #fab1a0; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT_READONLY</code> - Read-only root access, can view events for any company\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code> - Can only view events for their assigned company\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code> - Can only view events for their assigned company\n' +
      '- <code style="color: #6c5ce7; background: #f0f3ff; padding: 2px 6px; border-radius: 3px; font-weight: bold;">SALES_AGENT</code> - Can only view events for their assigned company\n' +
      '- <code style="color: #fdcb6e; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">HOST</code> - Can only view events for their assigned company\n' +
      '- <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">GUEST</code> - Basic read access for their assigned company\n\n' +
      '**Note:** This endpoint does NOT enforce company access validation at the query level.\n' +
      'Users should only request events for companies they have access to.',
  })
  @ApiParam({
    name: 'companyId',
    description: 'Unique identifier of the company to retrieve events for',
    type: 'string',
    format: 'uuid',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  @ApiQuery({
    name: 'isOnline',
    required: false,
    type: Boolean,
    description: 'Filter by online events',
  })
  @ApiQuery({
    name: 'isPhysical',
    required: false,
    type: Boolean,
    description: 'Filter by physical events',
  })
  @ApiQuery({
    name: 'isAppointment',
    required: false,
    type: Boolean,
    description: 'Filter by appointment events',
  })
  @ApiQuery({
    name: 'eventNamePattern',
    required: false,
    type: String,
    description: 'Search by event name pattern',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of results per page (1-100)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of results to skip',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Event catalog entries retrieved successfully with pagination metadata and filtered results',
    type: CompanyEventsListResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions - requires company_events:read permission',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Company not found or user does not have access to this company',
  })
  async getEvents(
    @Param('companyId') companyId: string,
    @Query('isActive') isActive?: boolean,
    @Query('isOnline') isOnline?: boolean,
    @Query('isPhysical') isPhysical?: boolean,
    @Query('isAppointment') isAppointment?: boolean,
    @Query('eventNamePattern') eventNamePattern?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ): Promise<CompanyEventsListResponseDto> {
    const query = this.mapper.toGetEventsQuery(companyId, {
      isActive,
      isOnline,
      isPhysical,
      isAppointment,
      eventNamePattern,
      limit,
      offset,
    });

    const result = await this.queryBus.execute(query);

    return this.mapper.toEventsListResponseDto(result);
  }

  @Get(':eventName')
  @CanRead('company_events')
  @ApiOperation({
    summary: 'Get a specific company event by name',
    description:
      'Retrieves detailed information for a specific event by its name.\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">company_events:read</code>\n\n' +
      '👥 **Roles with Read Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code> - Can view events for any company\n' +
      '- <code style="color: #e17055; background: #fab1a0; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT_READONLY</code> - Read-only root access, can view events for any company\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code> - Can only view events for their assigned company\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code> - Can only view events for their assigned company\n' +
      '- <code style="color: #6c5ce7; background: #f0f3ff; padding: 2px 6px; border-radius: 3px; font-weight: bold;">SALES_AGENT</code> - Can only view events for their assigned company\n' +
      '- <code style="color: #fdcb6e; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">HOST</code> - Can only view events for their assigned company\n' +
      '- <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">GUEST</code> - Basic read access for their assigned company\n\n' +
      '**Event Name Lookup:**\n' +
      '- Event name is automatically normalized for lookup (same rules as creation)\n' +
      '- You can search with the original name; it will be normalized automatically\n\n' +
      '**Note:** Query operations do NOT enforce company access validation.',
  })
  @ApiParam({
    name: 'companyId',
    description: 'Unique identifier of the company that owns the event',
    type: 'string',
    format: 'uuid',
  })
  @ApiParam({
    name: 'eventName',
    description: 'Name of the event to retrieve (will be automatically standardized for lookup)',
    type: 'string',
    example: 'Monthly Team Meeting',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Event catalog entry retrieved successfully with complete event details',
    type: CompanyEventResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description:
      'Event not found in company catalog, company not found, or user does not have access',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions - requires company_events:read permission',
  })
  async getEventByName(
    @Param('companyId') companyId: string,
    @Param('eventName') eventName: string,
  ): Promise<CompanyEventResponseDto> {
    const query = this.mapper.toGetEventByNameQuery(companyId, eventName);
    const result = await this.queryBus.execute(query);

    return this.mapper.toEventResponseDto(result);
  }

  @Put(':eventName')
  @CanWrite('company_events')
  @ApiOperation({
    summary: 'Update a company event',
    description:
      'Updates an existing event in the catalog. All fields are optional.\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">company_events:write</code>\n\n' +
      '👥 **Roles with Write Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code> - Can update events for any company\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code> - Can only update events for their assigned company\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code> - Can only update events for their assigned company\n\n' +
      '**Company Access Validation:**\n' +
      '- The command handler validates that the user has access to the company\n' +
      '- ROOT users bypass this validation\n' +
      '- Other roles must have matching companyId\n\n' +
      '**Update Behavior:**\n' +
      '- Only provided fields are updated\n' +
      '- Event name in URL is normalized for lookup\n' +
      '- Validation ensures data integrity after updates',
  })
  @ApiParam({
    name: 'companyId',
    description: 'Unique identifier of the company that owns the event',
    type: 'string',
    format: 'uuid',
  })
  @ApiParam({
    name: 'eventName',
    description: 'Current name of the event to update (will be standardized for lookup)',
    type: 'string',
    example: 'Monthly Team Meeting',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Event catalog entry updated successfully with updated details',
    type: CompanyEventResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Invalid input data - check field validation, duration format, pricing values, or boolean flags',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description:
      'Event not found in company catalog, company not found, or user does not have access',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions - requires company_events:write permission',
  })
  async updateEvent(
    @Param('companyId') companyId: string,
    @Param('eventName') eventName: string,
    @Body() updateEventDto: UpdateCompanyEventDto,
    @CurrentUser() user: IJwtPayload,
  ): Promise<CompanyEventResponseDto> {
    return this.transactionService.executeInTransaction(async () => {
      const command = this.mapper.toUpdateCommand(updateEventDto, eventName, companyId, user.sub);
      const result = await this.commandBus.execute(command);

      return this.mapper.toUpdateResponseDto(result);
    });
  }

  @Delete(':eventName')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CanDelete('company_events')
  @ApiOperation({
    summary: 'Delete a company event',
    description:
      'Permanently deletes an event from the company catalog. This action cannot be undone.\n\n' +
      '📋 **Required Permission:** <code style="color: #c0392b; background: #fadbd8; padding: 2px 6px; border-radius: 3px; font-weight: bold;">company_events:delete</code>\n\n' +
      '👥 **Roles with Delete Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code> - Can delete events for any company\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code> - Can only delete events for their assigned company\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code> - Can only delete events for their assigned company\n\n' +
      '**Company Access Validation:**\n' +
      '- The command handler validates company access before deletion\n' +
      '- ROOT users can delete from any company\n' +
      '- Other roles are restricted to their assigned company\n\n' +
      '**Important Notes:**\n' +
      '- This is a hard delete - data cannot be recovered\n' +
      '- Consider using isActive=false to soft delete instead\n' +
      '- Event name in URL is normalized for lookup',
  })
  @ApiParam({
    name: 'companyId',
    description: 'Unique identifier of the company that owns the event',
    type: 'string',
    format: 'uuid',
  })
  @ApiParam({
    name: 'eventName',
    description: 'Name of the event to delete (will be standardized for lookup)',
    type: 'string',
    example: 'Monthly Team Meeting',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Event catalog entry deleted successfully - no content returned',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description:
      'Event not found in company catalog, company not found, or user does not have access',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions - requires company_events:delete permission',
  })
  async deleteEvent(
    @Param('companyId') companyId: string,
    @Param('eventName') eventName: string,
    @CurrentUser() user: IJwtPayload,
  ): Promise<void> {
    return this.transactionService.executeInTransaction(async () => {
      const command = this.mapper.toDeleteCommand(eventName, companyId, user.sub);
      await this.commandBus.execute(command);
    });
  }
}
