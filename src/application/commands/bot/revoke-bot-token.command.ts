import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BotTokenService } from '@core/services/bot-token.service';
import { BOT_TOKEN_PROVIDER } from '@shared/constants/tokens';
import { IBotTokenProvider } from '@core/interfaces/bot-token-provider.interface';

export class RevokeBotTokenCommand {
  constructor(
    public readonly requestingUserId: string,
    public readonly tokenId: string,
  ) {}
}

@Injectable()
@CommandHandler(RevokeBotTokenCommand)
export class RevokeBotTokenHandler implements ICommandHandler<RevokeBotTokenCommand> {
  constructor(
    private readonly botTokenService: BotTokenService,
    @Inject(BOT_TOKEN_PROVIDER)
    private readonly botTokenProvider: IBotTokenProvider,
  ) {}

  async execute(command: RevokeBotTokenCommand): Promise<boolean> {
    // Validar en la capa de dominio
    await this.botTokenService.validateBotTokenRevocation(
      command.requestingUserId,
      command.tokenId,
    );

    // Delegar la revocación técnica a Infrastructure
    return this.botTokenProvider.revokeToken(command.tokenId);
  }
}
