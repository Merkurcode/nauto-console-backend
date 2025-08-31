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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import {
  CanRead,
  CanWrite,
  CanUpdate,
  CanDelete,
} from '@shared/decorators/resource-permissions.decorator';
import { WriteOperation, DeleteOperation } from '@shared/decorators/write-operation.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { TransactionService } from '@infrastructure/database/prisma/transaction.service';
import { CreateMarketingCampaignDto } from '@application/dtos/marketing-campaign/create-marketing-campaign.dto';
import { UpdateMarketingCampaignDto } from '@application/dtos/marketing-campaign/update-marketing-campaign.dto';
import { MarketingCampaignSwaggerDto } from '@application/dtos/_responses/marketing-campaign/marketing-campaign.swagger.dto';
import { IMarketingCampaignResponse } from '@application/dtos/_responses/marketing-campaign/marketing-campaign.response.interface';
import { CreateMarketingCampaignCommand } from '@application/commands/marketing-campaign/create-marketing-campaign.command';
import { UpdateMarketingCampaignCommand } from '@application/commands/marketing-campaign/update-marketing-campaign.command';
import { EnableMarketingCampaignCommand } from '@application/commands/marketing-campaign/enable-marketing-campaign.command';
import { DisableMarketingCampaignCommand } from '@application/commands/marketing-campaign/disable-marketing-campaign.command';
import { DeleteMarketingCampaignCommand } from '@application/commands/marketing-campaign/delete-marketing-campaign.command';
import { GetMarketingCampaignQuery } from '@application/queries/marketing-campaign/get-marketing-campaign.query';
import { GetCompanyMarketingCampaignsQuery } from '@application/queries/marketing-campaign/get-company-marketing-campaigns.query';
import { GetActiveMarketingCampaignsQuery } from '@application/queries/marketing-campaign/get-active-marketing-campaigns.query';

@ApiTags('marketing-campaigns')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('marketing-campaigns')
export class MarketingCampaignController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly transactionService: TransactionService,
  ) {}

  @Post()
  @CanWrite('marketing-campaign')
  @WriteOperation('marketing-campaign')
  @ApiOperation({
    summary: 'Create a new marketing campaign (Admin/Manager)',
    description:
      'Creates a new marketing campaign for a company.\n\n' +
      '**Features:**\n' +
      '- Auto-generates UTM name from reference name\n' +
      '- Supports Meta/Facebook campaign integration\n' +
      '- Optional promotion picture attachment\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">marketing-campaign:write</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code>\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code>\n\n' +
      '⚠️ **Restrictions:** User must have access to the specified company',
  })
  @ApiBody({
    type: CreateMarketingCampaignDto,
    description: 'Marketing campaign creation data',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Marketing campaign created successfully',
    type: MarketingCampaignSwaggerDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data or date range',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'UTM name already exists',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions or company access denied',
  })
  async create(
    @Body() dto: CreateMarketingCampaignDto,
    @CurrentUser('id') currentUserId: string,
  ): Promise<IMarketingCampaignResponse> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(new CreateMarketingCampaignCommand(dto, currentUserId));
    });
  }

  @Get(':id')
  @CanRead('marketing-campaign')
  @ApiOperation({
    summary: 'Get marketing campaign by ID',
    description:
      'Retrieves a specific marketing campaign by its ID.\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">marketing-campaign:read</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code>\n\n' +
      "⚠️ **Restrictions:** User must have access to the campaign's company",
  })
  @ApiParam({
    name: 'id',
    description: 'Marketing campaign ID',
    example: 'mc_1234567890_abc123',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Marketing campaign retrieved successfully',
    type: MarketingCampaignSwaggerDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Marketing campaign not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Access to campaign's company denied",
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser('id') currentUserId: string,
  ): Promise<IMarketingCampaignResponse> {
    return this.queryBus.execute(new GetMarketingCampaignQuery(id, currentUserId));
  }

  @Get('company/:companyId')
  @CanRead('marketing-campaign')
  @ApiOperation({
    summary: 'Get all marketing campaigns for a company',
    description:
      'Retrieves all marketing campaigns for a specific company.\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">marketing-campaign:read</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code>\n\n' +
      '⚠️ **Restrictions:** User must have access to the specified company',
  })
  @ApiParam({
    name: 'companyId',
    description: 'Company ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Marketing campaigns retrieved successfully',
    type: [MarketingCampaignSwaggerDto],
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access to company denied',
  })
  async findByCompany(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser('id') currentUserId: string,
  ): Promise<IMarketingCampaignResponse[]> {
    return this.queryBus.execute(new GetCompanyMarketingCampaignsQuery(companyId, currentUserId));
  }

  @Get('company/:companyId/active')
  @CanRead('marketing-campaign')
  @ApiOperation({
    summary: 'Get active marketing campaigns for a company',
    description:
      'Retrieves only active marketing campaigns (enabled and within date range) for a specific company.\n\n' +
      '**Active Campaign Criteria:**\n' +
      '- Campaign is enabled\n' +
      '- Current date is between start and end dates\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">marketing-campaign:read</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code>\n\n' +
      '⚠️ **Restrictions:** User must have access to the specified company',
  })
  @ApiParam({
    name: 'companyId',
    description: 'Company ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Active marketing campaigns retrieved successfully',
    type: [MarketingCampaignSwaggerDto],
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access to company denied',
  })
  async findActiveByCompany(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser('id') currentUserId: string,
  ): Promise<IMarketingCampaignResponse[]> {
    return this.queryBus.execute(new GetActiveMarketingCampaignsQuery(companyId, currentUserId));
  }

  @Put(':id')
  @CanUpdate('marketing-campaign')
  @WriteOperation('marketing-campaign')
  @ApiOperation({
    summary: 'Update marketing campaign details (Admin/Manager)',
    description:
      'Updates marketing campaign information.\n\n' +
      '**Note:** UTM name cannot be changed after creation.\n\n' +
      '📋 **Required Permission:** <code style="color: #f39c12; background: #fff3cd; padding: 2px 6px; border-radius: 3px; font-weight: bold;">marketing-campaign:update</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code>\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code>\n\n' +
      "⚠️ **Restrictions:** User must have access to the campaign's company",
  })
  @ApiParam({
    name: 'id',
    description: 'Marketing campaign ID',
    example: 'mc_1234567890_abc123',
  })
  @ApiBody({
    type: UpdateMarketingCampaignDto,
    description: 'Marketing campaign update data',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Marketing campaign updated successfully',
    type: MarketingCampaignSwaggerDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Marketing campaign not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions or company access denied',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMarketingCampaignDto,
    @CurrentUser('id') currentUserId: string,
  ): Promise<IMarketingCampaignResponse> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(new UpdateMarketingCampaignCommand(id, dto, currentUserId));
    });
  }

  @Post(':id/enable')
  @CanWrite('marketing-campaign')
  @WriteOperation('marketing-campaign')
  @ApiOperation({
    summary: 'Enable marketing campaign (Admin/Manager)',
    description:
      'Enables a marketing campaign, making it active if within date range.\n\n' +
      '📋 **Required Permission:** <code style="color: #8e44ad; background: #e8daef; padding: 2px 6px; border-radius: 3px; font-weight: bold;">marketing-campaign:manage</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code>\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code>\n\n' +
      "⚠️ **Restrictions:** User must have access to the campaign's company",
  })
  @ApiParam({
    name: 'id',
    description: 'Marketing campaign ID',
    example: 'mc_1234567890_abc123',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Marketing campaign enabled successfully',
    type: MarketingCampaignSwaggerDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Marketing campaign not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Campaign is already enabled',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions or company access denied',
  })
  async enable(
    @Param('id') id: string,
    @CurrentUser('id') currentUserId: string,
  ): Promise<IMarketingCampaignResponse> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(new EnableMarketingCampaignCommand(id, currentUserId));
    });
  }

  @Post(':id/disable')
  @CanWrite('marketing-campaign')
  @WriteOperation('marketing-campaign')
  @ApiOperation({
    summary: 'Disable marketing campaign (Admin/Manager)',
    description:
      'Disables a marketing campaign, making it inactive regardless of date range.\n\n' +
      '📋 **Required Permission:** <code style="color: #8e44ad; background: #e8daef; padding: 2px 6px; border-radius: 3px; font-weight: bold;">marketing-campaign:manage</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code>\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code>\n\n' +
      "⚠️ **Restrictions:** User must have access to the campaign's company",
  })
  @ApiParam({
    name: 'id',
    description: 'Marketing campaign ID',
    example: 'mc_1234567890_abc123',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Marketing campaign disabled successfully',
    type: MarketingCampaignSwaggerDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Marketing campaign not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Campaign is already disabled',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions or company access denied',
  })
  async disable(
    @Param('id') id: string,
    @CurrentUser('id') currentUserId: string,
  ): Promise<IMarketingCampaignResponse> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(new DisableMarketingCampaignCommand(id, currentUserId));
    });
  }

  @Delete(':id')
  @CanDelete('marketing-campaign')
  @DeleteOperation('marketing-campaign')
  @ApiOperation({
    summary: 'Delete marketing campaign (Admin only)',
    description:
      'Permanently deletes a marketing campaign.\n\n' +
      '📋 **Required Permission:** <code style="color: #c0392b; background: #fadbd8; padding: 2px 6px; border-radius: 3px; font-weight: bold;">marketing-campaign:delete</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code>\n\n' +
      "⚠️ **Restrictions:** User must have access to the campaign's company",
  })
  @ApiParam({
    name: 'id',
    description: 'Marketing campaign ID',
    example: 'mc_1234567890_abc123',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Marketing campaign deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Marketing campaign not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions or company access denied',
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') currentUserId: string,
  ): Promise<{ success: boolean }> {
    return this.transactionService.executeInTransaction(async () => {
      const result = await this.commandBus.execute(
        new DeleteMarketingCampaignCommand(id, currentUserId),
      );

      return { success: result };
    });
  }
}
