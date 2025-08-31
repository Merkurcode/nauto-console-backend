import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IMarketingCampaignResponse } from '@application/dtos/_responses/marketing-campaign/marketing-campaign.response.interface';
import { MarketingCampaignService } from '@core/services/marketing-campaign.service';
import { MarketingCampaignMapper } from '@application/mappers/marketing-campaign.mapper';
import { UserAuthorizationService } from '@core/services/user-authorization.service';

export class DisableMarketingCampaignCommand implements ICommand {
  constructor(
    public readonly id: string,
    public readonly currentUserId: string,
  ) {}
}

@CommandHandler(DisableMarketingCampaignCommand)
export class DisableMarketingCampaignHandler
  implements ICommandHandler<DisableMarketingCampaignCommand, IMarketingCampaignResponse>
{
  constructor(
    private readonly marketingCampaignService: MarketingCampaignService,
    private readonly userAuthService: UserAuthorizationService,
  ) {}

  async execute(command: DisableMarketingCampaignCommand): Promise<IMarketingCampaignResponse> {
    const { id, currentUserId } = command;

    const currentUser = await this.userAuthService.getCurrentUserSafely(currentUserId);

    const campaign = await this.marketingCampaignService.disableCampaign(id, currentUser);

    return MarketingCampaignMapper.toResponse(campaign);
  }
}
