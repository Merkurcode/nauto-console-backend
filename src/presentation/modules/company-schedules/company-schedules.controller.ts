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
import { CreateCompanyScheduleDto } from '@application/dtos/company-schedules/create-company-schedule.dto';
import { UpdateCompanyScheduleDto } from '@application/dtos/company-schedules/update-company-schedule.dto';
import {
  CompanyScheduleResponseDto,
  CompanySchedulesListResponseDto,
  CompanyWeeklyScheduleResponseDto,
} from '@application/dtos/company-schedules/company-schedule-response.dto';

// Mapper
import { CompanySchedulesMapper } from '@application/mappers/company-schedules.mapper';

// JWT Payload
import { IJwtPayload } from '@application/dtos/responses/user.response';

@ApiTags('company-schedules')
@Controller('companies/:companyId/schedules')
@UseGuards(RolesGuard, PermissionsGuard)
@ApiBearerAuth('JWT-auth')
export class CompanySchedulesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly transactionService: TransactionService,
    private readonly mapper: CompanySchedulesMapper,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CanWrite('company_schedules')
  @ApiOperation({
    summary: 'Create a new company schedule',
    description:
      'Creates a new schedule entry for a specific company and day of the week.\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">company_schedules:write</code>\n\n' +
      '👥 **Roles with Write Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code> - Full system access, can create schedules for any company\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code> - Company administrator, can only create schedules for their assigned company\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code> - Department manager, can only create schedules for their assigned company\n\n' +
      '**Company Access Validation:**\n' +
      '- Enforced at command handler level via UserAuthorizationService.canAccessCompany()\n' +
      '- ROOT users bypass company validation\n' +
      '- Other roles must have matching companyId with the target company\n' +
      '- Returns 403 Forbidden if user lacks access to the company\n\n' +
      '**Schedule Constraints:**\n' +
      '- Only one schedule per day of week per company\n' +
      '- Time ranges cannot overlap with existing schedules for the same day\n' +
      '- Duration must be between 30 minutes and 24 hours\n' +
      '- Start time must be before end time',
  })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Company schedule created successfully',
    type: CompanyScheduleResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Schedule for this day already exists or time conflict',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  async createSchedule(
    @Param('companyId') companyId: string,
    @Body() createScheduleDto: CreateCompanyScheduleDto,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<CompanyScheduleResponseDto> {
    return this.transactionService.executeInTransaction(async () => {
      const command = this.mapper.toCreateCommand(createScheduleDto, companyId, currentUser.sub);
      const result = await this.commandBus.execute(command);

      return this.mapper.toCreateResponseDto(result);
    });
  }

  @Get()
  @CanRead('company_schedules')
  @ApiOperation({
    summary: 'Get all company schedules',
    description:
      'Retrieves a paginated list of all schedules for a specific company.\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">company_schedules:read</code>\n\n' +
      '👥 **Roles with Read Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code> - Can view schedules for any company\n' +
      '- <code style="color: #e17055; background: #fab1a0; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT_READONLY</code> - Read-only root access, can view schedules for any company\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code> - Can only view schedules for their assigned company\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code> - Can only view schedules for their assigned company\n' +
      '- <code style="color: #6c5ce7; background: #f0f3ff; padding: 2px 6px; border-radius: 3px; font-weight: bold;">SALES_AGENT</code> - Can only view schedules for their assigned company\n' +
      '- <code style="color: #fdcb6e; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">HOST</code> - Can only view schedules for their assigned company\n' +
      '- <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">GUEST</code> - Basic read access for their assigned company\n\n' +
      '**Filtering Options:**\n' +
      '- `isActive` - Filter by active/inactive status\n' +
      '- `dayOfWeek` - Filter by specific day (0=Sunday, 6=Saturday)\n' +
      '- `limit` - Number of results per page (1-100)\n' +
      '- `offset` - Number of results to skip\n\n' +
      '**Note:** Query operations do NOT enforce company access validation at handler level.',
  })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  @ApiQuery({
    name: 'dayOfWeek',
    required: false,
    type: Number,
    description: 'Filter by day of week (0-6)',
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
    description: 'Company schedules retrieved successfully',
    type: CompanySchedulesListResponseDto,
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  async getSchedules(
    @Param('companyId') companyId: string,
    @Query('isActive') isActive?: boolean,
    @Query('dayOfWeek', new ParseIntPipe({ optional: true })) dayOfWeek?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ): Promise<CompanySchedulesListResponseDto> {
    const query = this.mapper.toGetSchedulesQuery(companyId, {
      isActive,
      dayOfWeek,
      limit,
      offset,
    });

    const result = await this.queryBus.execute(query);

    return this.mapper.toSchedulesListResponseDto(result);
  }

  @Get('weekly')
  @CanRead('company_schedules')
  @ApiOperation({
    summary: 'Get company weekly schedule with summary statistics',
    description:
      'Retrieves a complete weekly view of company schedules organized by days.\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">company_schedules:read</code>\n\n' +
      '👥 **Roles with Read Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code> - Can view weekly schedules for any company\n' +
      '- <code style="color: #e17055; background: #fab1a0; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT_READONLY</code> - Read-only access for any company\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code> - Can only view for their assigned company\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code> - Can only view for their assigned company\n' +
      '- <code style="color: #6c5ce7; background: #f0f3ff; padding: 2px 6px; border-radius: 3px; font-weight: bold;">SALES_AGENT</code> - Can only view for their assigned company\n' +
      '- <code style="color: #fdcb6e; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">HOST</code> - Can only view for their assigned company\n' +
      '- <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">GUEST</code> - Basic read access for their assigned company\n\n' +
      '**Response Includes:**\n' +
      '- Schedules organized by day (0=Sunday to 6=Saturday)\n' +
      '- Total working hours per week\n' +
      '- Number of working days\n' +
      '- Active/inactive schedule count',
  })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Company weekly schedule retrieved successfully',
    type: CompanyWeeklyScheduleResponseDto,
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  async getWeeklySchedule(
    @Param('companyId') companyId: string,
  ): Promise<CompanyWeeklyScheduleResponseDto> {
    const query = this.mapper.toGetWeeklyScheduleQuery(companyId);
    const result = await this.queryBus.execute(query);

    return this.mapper.toWeeklyScheduleResponseDto(result);
  }

  @Put(':scheduleId')
  @CanWrite('company_schedules')
  @ApiOperation({
    summary: 'Update a company schedule',
    description:
      'Updates an existing schedule entry. All fields are optional.\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">company_schedules:write</code>\n\n' +
      '👥 **Roles with Write Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code> - Can update schedules for any company\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code> - Can only update schedules for their assigned company\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code> - Can only update schedules for their assigned company\n\n' +
      '**Company Access Validation:**\n' +
      '- Validated in UpdateCompanyScheduleHandler via UserAuthorizationService\n' +
      "- Schedule's companyId is checked against user's access rights\n" +
      '- ROOT users bypass company validation\n' +
      "- Returns 403 if user lacks access to the schedule's company\n\n" +
      '**Update Constraints:**\n' +
      '- Time conflicts are validated if times are changed\n' +
      '- Start time must be before end time\n' +
      '- Duration between 30 minutes and 24 hours\n' +
      '- Cannot create overlapping schedules for the same day',
  })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiParam({ name: 'scheduleId', description: 'Schedule ID to update' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Company schedule updated successfully',
    type: CompanyScheduleResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Schedule not found' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Time conflict with existing schedule' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  async updateSchedule(
    @Param('companyId') companyId: string,
    @Param('scheduleId') scheduleId: string,
    @Body() updateScheduleDto: UpdateCompanyScheduleDto,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<CompanyScheduleResponseDto> {
    return this.transactionService.executeInTransaction(async () => {
      const command = this.mapper.toUpdateCommand(updateScheduleDto, scheduleId, currentUser.sub);
      const result = await this.commandBus.execute(command);

      return this.mapper.toUpdateResponseDto(result);
    });
  }

  @Delete(':scheduleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CanDelete('company_schedules')
  @ApiOperation({
    summary: 'Delete a company schedule',
    description:
      'Permanently deletes a specific schedule entry.\n\n' +
      '📋 **Required Permission:** <code style="color: #c0392b; background: #fadbd8; padding: 2px 6px; border-radius: 3px; font-weight: bold;">company_schedules:delete</code>\n\n' +
      '👥 **Roles with Delete Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code> - Can delete schedules for any company\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code> - Can only delete schedules for their assigned company\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code> - Can only delete schedules for their assigned company\n\n' +
      '**Company Access Validation:**\n' +
      '- Validated in DeleteCompanyScheduleHandler via UserAuthorizationService\n' +
      "- Schedule's companyId is checked against user's access rights\n" +
      '- ROOT users bypass company validation\n' +
      "- Returns 403 if user lacks access to the schedule's company\n\n" +
      '**Important Notes:**\n' +
      '- This is a hard delete - data cannot be recovered\n' +
      '- Consider setting isActive=false instead for soft delete\n' +
      '- Schedule history will be lost permanently',
  })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiParam({ name: 'scheduleId', description: 'Schedule ID to delete' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Company schedule deleted successfully',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Schedule not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  async deleteSchedule(
    @Param('companyId') companyId: string,
    @Param('scheduleId') scheduleId: string,
    @CurrentUser() user: IJwtPayload,
  ): Promise<void> {
    return this.transactionService.executeInTransaction(async () => {
      const command = this.mapper.toDeleteCommand(scheduleId, user.sub);
      await this.commandBus.execute(command);
    });
  }
}
