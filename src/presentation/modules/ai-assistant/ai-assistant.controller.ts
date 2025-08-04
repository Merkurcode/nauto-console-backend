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
  AIAssistantResponse,
  CompanyAIAssistantResponse,
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
  @ApiOperation({
    summary: 'Get all available AI assistants (Public)',
    description:
      'Retrieves a list of all AI assistants available in the system with their features and descriptions.\\n\\n**Required Permissions:** None (Public endpoint)\\n**Required Roles:** Any authenticated user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Available AI assistants retrieved successfully',
    type: [AIAssistantResponse],
    example: [
      {
        id: 'b2c3d4e5-f6g7-8901-bcde-f23456789012',
        name: 'Lily',
        area: 'Marketing & Branding',
        description:
          'AI assistant specialized in marketing strategies, brand management, and customer engagement tactics',
        available: true,
        features: [
          {
            id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            keyName: 'BRAND_EXPERT',
            title: 'Brand Expert',
            description: 'Provides expert knowledge about brand guidelines',
          },
        ],
      },
    ],
  })
  async getAvailableAssistants(
    @Query() query: GetAvailableAssistantsDto,
  ): Promise<IAIAssistantResponse[]> {
    return this.queryBus.execute(new GetAvailableAssistantsQuery(query.lang));
  }

  @Get('company/:companyId')
  @RequirePermissions('ai-assistant:read')
  @ApiOperation({
    summary: 'Get AI assistants assigned to a company',
    description:
      'Retrieves all AI assistants that have been assigned to a specific company, including their enabled status and feature configurations.\\n\\n**Required Permissions:** ai-assistant:read\\n**Required Roles:** Any authenticated user with ai-assistant:read permission',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Company AI assistants retrieved successfully',
    type: [CompanyAIAssistantResponse],
    example: [
      {
        id: 'c3d4e5f6-g7h8-9012-cdef-g34567890123',
        assistantId: 'b2c3d4e5-f6g7-8901-bcde-f23456789012',
        enabled: true,
        assistant: {
          id: 'b2c3d4e5-f6g7-8901-bcde-f23456789012',
          name: 'Lily',
          area: 'Marketing & Branding',
          description: 'AI assistant specialized in marketing strategies',
          enabled: true,
          features: [
            {
              id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
              keyName: 'BRAND_EXPERT',
              title: 'Brand Expert',
              description: 'Provides expert knowledge about brand guidelines',
              enabled: true,
            },
          ],
        },
      },
    ],
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions (requires ai-assistant:read permission)',
    example: {
      statusCode: 403,
      message: 'Insufficient permissions - requires ai-assistant:read permission',
      error: 'Forbidden',
    },
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
  @ApiOperation({
    summary: 'Assign AI assistant to company with features (Root Only)',
    description:
      'Assigns an AI assistant to a company with specific feature configurations. Creates a new assignment and configures individual features.\\n\\n**Required Permissions:** ai-assistant:update\\n**Required Roles:** root\\n**Access Level:** Root users only\\n**Write Operation:** Yes (blocked for root_readonly)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'AI assistant assigned successfully',
    example: {
      message: 'AI assistant successfully assigned to company',
      assignmentId: 'c3d4e5f6-g7h8-9012-cdef-g34567890123',
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
    example: {
      statusCode: 400,
      message: ['companyId must be a UUID', 'aiAssistantId must be a UUID'],
      error: 'Bad Request',
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions (requires ai-assistant:update permission and root role)',
    example: {
      statusCode: 403,
      message: 'Insufficient permissions - requires ai-assistant:update permission and root role',
      error: 'Forbidden',
    },
  })
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
  @ApiOperation({
    summary: 'Toggle AI assistant enabled status for company (Root Only)',
    description:
      'Enables or disables an AI assistant for a specific company. This controls whether the assistant is available for use by the company.\\n\\n**Required Permissions:** ai-assistant:update\\n**Required Roles:** root\\n**Access Level:** Root users only\\n**Write Operation:** Yes (blocked for root_readonly)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'AI assistant status updated successfully',
    example: {
      message: 'AI assistant status updated successfully',
      enabled: false,
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Assignment not found',
    example: {
      statusCode: 404,
      message: 'AI assistant assignment not found for this company',
      error: 'Not Found',
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions (requires ai-assistant:update permission and root role)',
    example: {
      statusCode: 403,
      message: 'Insufficient permissions - requires ai-assistant:update permission and root role',
      error: 'Forbidden',
    },
  })
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
  @ApiOperation({
    summary: 'Toggle AI assistant feature enabled status (Root Only)',
    description:
      'Enables or disables a specific feature for an AI assistant assignment. This allows granular control over which capabilities are available for each company-assistant combination.\\n\\n**Required Permissions:** ai-assistant:update\\n**Required Roles:** root\\n**Access Level:** Root users only\\n**Write Operation:** Yes (blocked for root_readonly)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'AI assistant feature status updated successfully',
    example: {
      message: 'AI assistant feature status updated successfully',
      featureId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      enabled: true,
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Assignment or feature not found',
    example: {
      statusCode: 404,
      message: 'AI assistant assignment or feature not found',
      error: 'Not Found',
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions (requires ai-assistant:update permission and root role)',
    example: {
      statusCode: 403,
      message: 'Insufficient permissions - requires ai-assistant:update permission and root role',
      error: 'Forbidden',
    },
  })
  async toggleFeatureStatus(@Body() dto: ToggleFeatureStatusDto) {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(
        new ToggleFeatureStatusCommand(dto.assignmentId, dto.featureId, dto.enabled),
      );
    });
  }
}
