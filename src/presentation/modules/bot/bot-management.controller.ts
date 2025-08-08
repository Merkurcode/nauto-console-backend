import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TransactionService } from '@infrastructure/database/prisma/transaction.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
// Guards and decorators
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { RolesGuard } from '@presentation/guards/roles.guard';
import { PermissionsGuard } from '@presentation/guards/permissions.guard';
import { RootReadOnlyGuard } from '@presentation/guards/root-readonly.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { Roles } from '@shared/decorators/roles.decorator';
import { RequirePermissions } from '@shared/decorators/permissions.decorator';
import { WriteOperation } from '@shared/decorators/write-operation.decorator';
import { RolesEnum } from '@shared/constants/enums';

// Commands and Queries
import { GenerateBotTokenCommand } from '@application/commands/bot/generate-bot-token.command';
import { RevokeBotTokenCommand } from '@application/commands/bot/revoke-bot-token.command';
import { ListBotTokensQuery } from '@application/queries/bot/list-bot-tokens.query';
import { CreateBotUserCommand } from '@application/commands/user/create-bot-user.command';
import { IJwtPayload, IUserDetailResponse } from '@application/dtos/responses/user.response';

// DTOs
import { GenerateBotTokenDto } from '@application/dtos/requests/bot/generate-bot-token.dto';
import { CreateBotUserDto } from '@application/dtos/user/create-bot-user.dto';
import { BotTokenResponse } from '@application/dtos/responses/bot/bot-token.response';
import { NoBots } from '@shared/decorators/bot-restrictions.decorator';

/**
 * Controller for BOT user and token management
 * Uses CQRS pattern for Clean Architecture compliance
 * - Bot user creation: ROOT users only
 * - Token management: ROOT users only
 * - Delegates business logic to Application layer
 */
@ApiTags('bot-management')
@NoBots()
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, RootReadOnlyGuard)
@Controller('bot-management')
export class BotManagementController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly transactionService: TransactionService,
    private readonly transactionContext: TransactionContextService,
  ) {}

  private async executeInTransactionWithContext<T>(callback: () => Promise<T>): Promise<T> {
    return this.transactionService.executeInTransaction(async tx => {
      this.transactionContext.setTransactionClient(tx);

      try {
        return await callback();
      } finally {
        this.transactionContext.clearTransaction();
      }
    });
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @Roles(RolesEnum.ROOT)
  @RequirePermissions('user:write')
  @WriteOperation('bot')
  @ApiOperation({
    summary: 'Create bot user for company',
    description:
      'Creates a new bot user for external chatbot integrations. Bot users are assigned to specific companies and can be used to authenticate API requests.\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">user:write</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code> - Can create bot users for any company\n\n' +
      '🤖 **Bot User Features:**\n' +
      '- Unique alias for identification\n' +
      '- Company-scoped access\n' +
      '- Designed for API authentication\n\n' +
      '⚠️ **Restrictions:** ROOT_READONLY users cannot perform this operation',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Bot user created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
        email: { type: 'string', example: 'chatbot@company.com' },
        alias: { type: 'string', example: 'chatbot-external-001' },
        firstName: { type: 'string', example: 'Bot' },
        lastName: { type: 'string', example: 'User' },
        isActive: { type: 'boolean', example: true },
        companyId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Email or alias already exists',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'User does not have user:write permission or Root readonly users cannot perform write operations',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Company not found',
  })
  async createBotUser(
    @Body() createBotUserDto: CreateBotUserDto,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<IUserDetailResponse> {
    return this.executeInTransactionWithContext(async () => {
      const { alias, companyId, password } = createBotUserDto;

      const command = new CreateBotUserCommand(alias, companyId, password, currentUser.sub);

      return this.commandBus.execute(command);
    });
  }

  @Post('tokens/generate')
  @HttpCode(HttpStatus.CREATED)
  @Roles(RolesEnum.ROOT)
  @RequirePermissions('bot:write')
  @WriteOperation('bot')
  @ApiOperation({
    summary: 'Generate BOT token',
    description:
      'Generate a new BOT token with extended expiration. Only ROOT users.\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">bot:write</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n\n' +
      '⚠️ **Restrictions:** ROOT_READONLY users cannot perform this operation',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'BOT token generated successfully',
    type: BotTokenResponse,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'Only ROOT users with bot:write permission can generate BOT tokens, or Root readonly users cannot perform write operations',
  })
  async generateBotToken(
    @CurrentUser() user: IJwtPayload,
    @Body() generateBotTokenDto: GenerateBotTokenDto,
  ): Promise<BotTokenResponse> {
    return this.commandBus.execute(
      new GenerateBotTokenCommand(
        user.sub,
        generateBotTokenDto.botAlias,
        generateBotTokenDto.password,
      ),
    );
  }

  @Get('tokens')
  @Roles(RolesEnum.ROOT)
  @RequirePermissions('bot:read')
  @ApiOperation({
    summary: 'List active BOT tokens',
    description:
      'List all active BOT tokens. Only ROOT users.\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">bot:read</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Active BOT tokens retrieved successfully',
  })
  async listActiveBotTokens(@CurrentUser() user: IJwtPayload) {
    return this.queryBus.execute(new ListBotTokensQuery(user.sub));
  }

  @Delete('tokens/:tokenId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(RolesEnum.ROOT)
  @RequirePermissions('bot:delete')
  @WriteOperation('bot')
  @ApiOperation({
    summary: 'Revoke BOT token',
    description:
      'Revoke a specific BOT token. Only ROOT users.\n\n' +
      '📋 **Required Permission:** <code style="color: #c0392b; background: #fadbd8; padding: 2px 6px; border-radius: 3px; font-weight: bold;">bot:delete</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n\n' +
      '⚠️ **Restrictions:** ROOT_READONLY users cannot perform this operation',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'BOT token revoked successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'Only ROOT users with bot:delete permission can revoke BOT tokens, or Root readonly users cannot perform write operations',
  })
  async revokeBotToken(
    @CurrentUser() user: IJwtPayload,
    @Param('tokenId') tokenId: string,
  ): Promise<void> {
    await this.commandBus.execute(new RevokeBotTokenCommand(user.sub, tokenId));
  }
}
