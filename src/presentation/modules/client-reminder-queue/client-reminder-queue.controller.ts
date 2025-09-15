import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
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
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { WriteOperation, DeleteOperation } from '@shared/decorators/write-operation.decorator';
import { TrimStringPipe } from '@shared/pipes/trim-string.pipe';
import { TransactionService } from '@infrastructure/database/prisma/transaction.service';

// DTOs
import { CreateClientReminderQueueDto } from '@application/dtos/client-reminder-queue/create-client-reminder-queue.dto';
import { UpdateClientReminderQueueDto } from '@application/dtos/client-reminder-queue/update-client-reminder-queue.dto';
import { ToggleQueueActiveDto } from '@application/dtos/client-reminder-queue/toggle-queue-active.dto';
import { IClientReminderQueueResponse } from '@application/dtos/_responses/client-reminder-queue/client-reminder-queue.response';

// Commands
import { CreateClientReminderQueueCommand } from '@application/commands/client-reminder-queue/create-client-reminder-queue.command';
import { UpdateClientReminderQueueCommand } from '@application/commands/client-reminder-queue/update-client-reminder-queue.command';
import { ToggleQueueActiveCommand } from '@application/commands/client-reminder-queue/toggle-queue-active.command';
import { DeleteClientReminderQueueCommand } from '@application/commands/client-reminder-queue/delete-client-reminder-queue.command';

// Queries
import {
  GetClientReminderQueuesQuery,
  IGetClientReminderQueuesResponse,
} from '@application/queries/client-reminder-queue/get-client-reminder-queues.query';
import { GetClientReminderQueueQuery } from '@application/queries/client-reminder-queue/get-client-reminder-queue.query';
import { ReminderQueueStatus } from '@prisma/client';

@ApiTags('client-reminder-queues')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('client-reminder-queues')
export class ClientReminderQueueController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly transactionService: TransactionService,
  ) {}

  @Post()
  @WriteOperation('client-reminder-queue')
  @ApiOperation({ summary: 'Create a new client reminder queue' })
  @ApiResponse({
    status: 201,
    description: 'Client reminder queue created successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Queue name already exists' })
  async createQueue(
    @Body() dto: CreateClientReminderQueueDto,
    @CurrentUser() user: IJwtPayload,
  ): Promise<IClientReminderQueueResponse> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(
        new CreateClientReminderQueueCommand(
          dto.name,
          dto.description,
          dto.template,
          dto.targetMedium,
          dto.notifyType,
          dto.callActions,
          dto.active,
          user.companyId!,
          user.sub,
          new Date(dto.startDate),
          new Date(dto.endDate),
          dto.interval,
          dto.days || [],
          dto.startHour,
          dto.endHour,
          dto.timezone,
          dto.frequency,
          dto.maxCount,
          dto.stopUntil ? new Date(dto.stopUntil) : undefined,
        ),
      );
    });
  }

  @Put(':id')
  @WriteOperation('client-reminder-queue')
  @ApiOperation({ summary: 'Update a client reminder queue' })
  @ApiParam({ name: 'id', description: 'Queue ID' })
  @ApiResponse({
    status: 200,
    description: 'Client reminder queue updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  @ApiResponse({ status: 409, description: 'Queue name already exists' })
  async updateQueue(
    @Param('id', TrimStringPipe) id: string,
    @Body() dto: UpdateClientReminderQueueDto,
    @CurrentUser() user: IJwtPayload,
  ): Promise<IClientReminderQueueResponse> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(
        new UpdateClientReminderQueueCommand(id, user.companyId!, user.sub, {
          name: dto.name,
          description: dto.description,
          template: dto.template,
          targetMedium: dto.targetMedium,
          notifyType: dto.notifyType,
          callActions: dto.callActions,
          active: dto.active,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          interval: dto.interval,
          days: dto.days,
          startHour: dto.startHour,
          endHour: dto.endHour,
          maxCount: dto.maxCount,
          timezone: dto.timezone,
          frequency: dto.frequency,
          stopUntil: dto.stopUntil ? new Date(dto.stopUntil) : undefined,
        }),
      );
    });
  }

  @Put(':id/active')
  @WriteOperation('client-reminder-queue')
  @ApiOperation({ summary: 'Toggle queue active status' })
  @ApiParam({ name: 'id', description: 'Queue ID' })
  @ApiResponse({
    status: 200,
    description: 'Queue active status toggled successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async toggleActive(
    @Param('id', TrimStringPipe) id: string,
    @Body() dto: ToggleQueueActiveDto,
    @CurrentUser() user: IJwtPayload,
  ): Promise<IClientReminderQueueResponse> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(
        new ToggleQueueActiveCommand(id, user.companyId!, dto.active, user.sub),
      );
    });
  }

  @Delete(':id')
  @DeleteOperation('client-reminder-queue')
  @ApiOperation({ summary: 'Delete a client reminder queue' })
  @ApiParam({ name: 'id', description: 'Queue ID' })
  @ApiResponse({
    status: 204,
    description: 'Client reminder queue deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async deleteQueue(
    @Param('id', TrimStringPipe) id: string,
    @CurrentUser() user: IJwtPayload,
  ): Promise<void> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(new DeleteClientReminderQueueCommand(id, user.companyId!));
    });
  }

  @Get()
  @ApiOperation({ summary: 'Get client reminder queues for company' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ReminderQueueStatus,
    description: 'Filter by queue status',
  })
  @ApiQuery({
    name: 'active',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of results (default: 50, max: 100)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of results to skip (default: 0)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of client reminder queues',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getQueues(
    @CurrentUser() user: IJwtPayload,
    @Query('status') status?: ReminderQueueStatus,
    @Query('active') active?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ): Promise<IGetClientReminderQueuesResponse> {
    const activeFilter = active === 'true' ? true : active === 'false' ? false : undefined;
    const limitValue = Math.min(limit || 50, 100); // Cap at 100
    const offsetValue = offset || 0;

    return this.queryBus.execute(
      new GetClientReminderQueuesQuery(
        user.companyId!,
        {
          status,
          active: activeFilter,
        },
        limitValue,
        offsetValue,
      ),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific client reminder queue' })
  @ApiParam({ name: 'id', description: 'Queue ID' })
  @ApiResponse({
    status: 200,
    description: 'Client reminder queue details',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async getQueue(
    @Param('id', TrimStringPipe) id: string,
    @CurrentUser() user: IJwtPayload,
  ): Promise<IClientReminderQueueResponse> {
    return this.queryBus.execute(new GetClientReminderQueueQuery(id, user.companyId!));
  }
}
