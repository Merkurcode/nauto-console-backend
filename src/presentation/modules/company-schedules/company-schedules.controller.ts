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
  @ApiOperation({ summary: 'Create a new company schedule' })
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
    @CurrentUser() _user: IJwtPayload,
  ): Promise<CompanyScheduleResponseDto> {
    return this.transactionService.executeInTransaction(async () => {
      const command = this.mapper.toCreateCommand(createScheduleDto, companyId);
      const result = await this.commandBus.execute(command);

      return this.mapper.toCreateResponseDto(result);
    });
  }

  @Get()
  @CanRead('company_schedules')
  @ApiOperation({ summary: 'Get all company schedules' })
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
  @ApiOperation({ summary: 'Get company weekly schedule with summary statistics' })
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
  @ApiOperation({ summary: 'Update a company schedule' })
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
    @CurrentUser() _user: IJwtPayload,
  ): Promise<CompanyScheduleResponseDto> {
    return this.transactionService.executeInTransaction(async () => {
      const command = this.mapper.toUpdateCommand(updateScheduleDto, scheduleId);
      const result = await this.commandBus.execute(command);

      return this.mapper.toUpdateResponseDto(result);
    });
  }

  @Delete(':scheduleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CanDelete('company_schedules')
  @ApiOperation({ summary: 'Delete a company schedule' })
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
    @CurrentUser() _user: IJwtPayload,
  ): Promise<void> {
    return this.transactionService.executeInTransaction(async () => {
      const command = this.mapper.toDeleteCommand(scheduleId);
      await this.commandBus.execute(command);
    });
  }
}
