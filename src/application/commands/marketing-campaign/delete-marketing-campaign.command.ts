import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { MarketingCampaignService } from '@core/services/marketing-campaign.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';

export class DeleteMarketingCampaignCommand implements ICommand {
  constructor(
    public readonly id: string,
    public readonly currentUserId: string,
  ) {}
}

@CommandHandler(DeleteMarketingCampaignCommand)
export class DeleteMarketingCampaignHandler
  implements ICommandHandler<DeleteMarketingCampaignCommand, boolean>
{
  constructor(
    private readonly marketingCampaignService: MarketingCampaignService,
    private readonly userAuthService: UserAuthorizationService,
  ) {}

  async execute(command: DeleteMarketingCampaignCommand): Promise<boolean> {
    const { id, currentUserId } = command;

    const currentUser = await this.userAuthService.getCurrentUserSafely(currentUserId);

    return await this.marketingCampaignService.deleteCampaign(id, currentUser);
  }
}
