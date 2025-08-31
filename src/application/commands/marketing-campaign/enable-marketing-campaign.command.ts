import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IMarketingCampaignResponse } from '@application/dtos/_responses/marketing-campaign/marketing-campaign.response.interface';
import { MarketingCampaignService } from '@core/services/marketing-campaign.service';
import { MarketingCampaignMapper } from '@application/mappers/marketing-campaign.mapper';
import { UserAuthorizationService } from '@core/services/user-authorization.service';

export class EnableMarketingCampaignCommand implements ICommand {
  constructor(
    public readonly id: string,
    public readonly currentUserId: string,
  ) {}
}

@CommandHandler(EnableMarketingCampaignCommand)
export class EnableMarketingCampaignHandler
  implements ICommandHandler<EnableMarketingCampaignCommand, IMarketingCampaignResponse>
{
  constructor(
    private readonly marketingCampaignService: MarketingCampaignService,
    private readonly userAuthService: UserAuthorizationService,
  ) {}

  async execute(command: EnableMarketingCampaignCommand): Promise<IMarketingCampaignResponse> {
    const { id, currentUserId } = command;

    const currentUser = await this.userAuthService.getCurrentUserSafely(currentUserId);

    const campaign = await this.marketingCampaignService.enableCampaign(id, currentUser);

    return MarketingCampaignMapper.toResponse(campaign);
  }
}
