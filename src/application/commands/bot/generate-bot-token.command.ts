import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BotTokenService } from '@core/services/bot-token.service';
import { BOT_TOKEN_PROVIDER } from '@shared/constants/tokens';
import { IBotTokenProvider } from '@core/interfaces/bot-token-provider.interface';

export class GenerateBotTokenCommand {
  constructor(
    public readonly requestingUserId: string,
    public readonly botAlias: string,
    public readonly password: string,
  ) {}
}

export interface IGenerateBotTokenResponse {
  accessToken: string;
  expiresIn: string;
  tokenId: string;
}

@Injectable()
@CommandHandler(GenerateBotTokenCommand)
export class GenerateBotTokenHandler implements ICommandHandler<GenerateBotTokenCommand> {
  constructor(
    private readonly botTokenService: BotTokenService,
    @Inject(BOT_TOKEN_PROVIDER)
    private readonly botTokenProvider: IBotTokenProvider,
  ) {}

  async execute(command: GenerateBotTokenCommand): Promise<IGenerateBotTokenResponse> {
    // Validate bot user credentials and get bot user info
    const { botUser } = await this.botTokenService.validateBotTokenGenerationByAlias(
      command.requestingUserId,
      command.botAlias,
      command.password,
    );

    // Generate token ID
    const tokenId = this.botTokenService.generateTokenId();

    // Delegate token generation to Infrastructure layer
    const token = await this.botTokenProvider.generateToken({
      botUserId: botUser.id.getValue(),
      botEmail: botUser.email.getValue(),
      tokenId,
      companyId: botUser.companyId?.getValue(),
    });

    return {
      accessToken: token.accessToken,
      expiresIn: token.expiresIn,
      tokenId: token.tokenId,
    };
  }
}
