import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TransactionService } from '@infrastructure/database/prisma/transaction.service';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '@presentation/guards/permissions.guard';
import { RolesGuard } from '@presentation/guards/roles.guard';
import { RootReadOnlyGuard } from '@presentation/guards/root-readonly.guard';
import { RequirePermissions } from '@shared/decorators/permissions.decorator';
import { WriteOperation } from '@shared/decorators/write-operation.decorator';
import { Roles } from '@shared/decorators/roles.decorator';
import { RolesEnum } from '@shared/constants/enums';

import { GetAvailableAssistantsDto } from '@application/dtos/ai-assistant/get-available-assistants.dto';
import { AssignAssistantToCompanyDto } from '@application/dtos/ai-assistant/assign-assistant-to-company.dto';
import { ToggleAssistantStatusDto } from '@application/dtos/ai-assistant/toggle-assistant-status.dto';
import { ToggleFeatureStatusDto } from '@application/dtos/ai-assistant/toggle-feature-status.dto';

import {
  IAIAssistantResponse,
  ICompanyAIAssistantResponse,
} from '@application/dtos/responses/ai-assistant.response';

import { GetAvailableAssistantsQuery } from '@application/queries/ai-assistant/get-available-assistants.query';
import { GetCompanyAssistantsQuery } from '@application/queries/ai-assistant/get-company-assistants.query';
import { AssignAssistantToCompanyCommand } from '@application/commands/ai-assistant/assign-assistant-to-company.command';
import { ToggleAssistantStatusCommand } from '@application/commands/ai-assistant/toggle-assistant-status.command';
import { ToggleFeatureStatusCommand } from '@application/commands/ai-assistant/toggle-feature-status.command';

@ApiTags('AI Assistants')
@ApiBearerAuth('JWT-auth')
@Controller('ai-assistants')
@UseGuards(JwtAuthGuard, PermissionsGuard, RolesGuard, RootReadOnlyGuard)
export class AIAssistantController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    private readonly transactionService: TransactionService,
  ) {}

  @Get('available')
  @ApiOperation({ summary: 'Get all available AI assistants' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Available AI assistants retrieved successfully',
  })
  async getAvailableAssistants(
    @Query() query: GetAvailableAssistantsDto,
  ): Promise<IAIAssistantResponse[]> {
    return this.queryBus.execute(new GetAvailableAssistantsQuery(query.lang));
  }

  @Get('company/:companyId')
  @RequirePermissions('ai-assistant:read')
  @ApiOperation({ summary: 'Get AI assistants assigned to a company' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Company AI assistants retrieved successfully',
  })
  async getCompanyAssistants(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: GetAvailableAssistantsDto,
  ): Promise<ICompanyAIAssistantResponse[]> {
    return this.queryBus.execute(new GetCompanyAssistantsQuery(companyId, query.lang));
  }

  @Post('assign')
  @WriteOperation('ai-assistant')
  @RequirePermissions('ai-assistant:update')
  @Roles(RolesEnum.ROOT)
  @ApiOperation({ summary: 'Assign AI assistant to company with features' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'AI assistant assigned successfully' })
  async assignAssistantToCompany(@Body() dto: AssignAssistantToCompanyDto) {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(
        new AssignAssistantToCompanyCommand(
          dto.companyId,
          dto.aiAssistantId,
          dto.enabled,
          dto.features,
        ),
      );
    });
  }

  @Put('toggle-status')
  @WriteOperation('ai-assistant')
  @RequirePermissions('ai-assistant:update')
  @Roles(RolesEnum.ROOT)
  @ApiOperation({ summary: 'Toggle AI assistant enabled status for company' })
  @ApiResponse({ status: HttpStatus.OK, description: 'AI assistant status updated successfully' })
  async toggleAssistantStatus(@Body() dto: ToggleAssistantStatusDto) {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(
        new ToggleAssistantStatusCommand(dto.companyId, dto.aiAssistantId, dto.enabled),
      );
    });
  }

  @Put('toggle-feature')
  @WriteOperation('ai-assistant')
  @RequirePermissions('ai-assistant:update')
  @Roles(RolesEnum.ROOT)
  @ApiOperation({ summary: 'Toggle AI assistant feature enabled status' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'AI assistant feature status updated successfully',
  })
  async toggleFeatureStatus(@Body() dto: ToggleFeatureStatusDto) {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(
        new ToggleFeatureStatusCommand(dto.assignmentId, dto.featureId, dto.enabled),
      );
    });
  }
}
