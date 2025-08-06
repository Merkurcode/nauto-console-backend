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
  @ApiOperation({ summary: 'Create a new company event catalog entry' })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Event catalog entry created successfully',
    type: CompanyEventResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Event name already exists' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  async createEvent(
    @Param('companyId') companyId: string,
    @Body() createEventDto: CreateCompanyEventDto,
    @CurrentUser() _user: IJwtPayload,
  ): Promise<CompanyEventResponseDto> {
    return this.transactionService.executeInTransaction(async () => {
      const command = this.mapper.toCreateCommand(createEventDto, companyId);
      const result = await this.commandBus.execute(command);

      return this.mapper.toCreateResponseDto(result);
    });
  }

  @Get()
  @CanRead('company_events')
  @ApiOperation({ summary: 'Get all company event catalog entries' })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
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
    description: 'Event catalog entries retrieved successfully',
    type: CompanyEventsListResponseDto,
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
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
  @ApiOperation({ summary: 'Get a specific company event catalog entry by name' })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiParam({ name: 'eventName', description: 'Event name (will be standardized)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Event catalog entry retrieved successfully',
    type: CompanyEventResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Event not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
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
  @ApiOperation({ summary: 'Update a company event catalog entry' })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiParam({ name: 'eventName', description: 'Event name to update' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Event catalog entry updated successfully',
    type: CompanyEventResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Event not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  async updateEvent(
    @Param('companyId') companyId: string,
    @Param('eventName') eventName: string,
    @Body() updateEventDto: UpdateCompanyEventDto,
    @CurrentUser() _user: IJwtPayload,
  ): Promise<CompanyEventResponseDto> {
    return this.transactionService.executeInTransaction(async () => {
      const command = this.mapper.toUpdateCommand(updateEventDto, eventName, companyId);
      const result = await this.commandBus.execute(command);

      return this.mapper.toUpdateResponseDto(result);
    });
  }

  @Delete(':eventName')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CanDelete('company_events')
  @ApiOperation({ summary: 'Delete a company event catalog entry' })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiParam({ name: 'eventName', description: 'Event name to delete' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Event catalog entry deleted successfully',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Event not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  async deleteEvent(
    @Param('companyId') companyId: string,
    @Param('eventName') eventName: string,
    @CurrentUser() _user: IJwtPayload,
  ): Promise<void> {
    return this.transactionService.executeInTransaction(async () => {
      const command = this.mapper.toDeleteCommand(eventName, companyId);
      await this.commandBus.execute(command);
    });
  }
}
