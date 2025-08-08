import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { BotTokenService } from '@core/services/bot-token.service';
import { BOT_TOKEN_PROVIDER } from '@shared/constants/tokens';
import { IBotTokenProvider } from '@core/interfaces/bot-token-provider.interface';

export class ListBotTokensQuery {
  constructor(public readonly requestingUserId: string) {}
}

export interface IBotTokenInfo {
  tokenId: string;
  botUserId: string;
  companyId?: string;
  createdAt: Date;
}

@Injectable()
@QueryHandler(ListBotTokensQuery)
export class ListBotTokensHandler implements IQueryHandler<ListBotTokensQuery> {
  constructor(
    private readonly botTokenService: BotTokenService,
    @Inject(BOT_TOKEN_PROVIDER)
    private readonly botTokenProvider: IBotTokenProvider,
  ) {}

  async execute(query: ListBotTokensQuery): Promise<IBotTokenInfo[]> {
    // Validar en la capa de dominio
    await this.botTokenService.validateBotTokenListing(query.requestingUserId);

    // Delegar la consulta técnica a Infrastructure
    return this.botTokenProvider.listActiveTokens();
  }
}
