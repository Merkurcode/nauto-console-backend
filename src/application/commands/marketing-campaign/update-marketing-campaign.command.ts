import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateMarketingCampaignDto } from '@application/dtos/marketing-campaign/update-marketing-campaign.dto';
import { IMarketingCampaignResponse } from '@application/dtos/_responses/marketing-campaign/marketing-campaign.response.interface';
import { MarketingCampaignService } from '@core/services/marketing-campaign.service';
import { MarketingCampaignMapper } from '@application/mappers/marketing-campaign.mapper';
import { UserAuthorizationService } from '@core/services/user-authorization.service';

export class UpdateMarketingCampaignCommand implements ICommand {
  constructor(
    public readonly id: string,
    public readonly dto: UpdateMarketingCampaignDto,
    public readonly currentUserId: string,
  ) {}
}

@CommandHandler(UpdateMarketingCampaignCommand)
export class UpdateMarketingCampaignHandler
  implements ICommandHandler<UpdateMarketingCampaignCommand, IMarketingCampaignResponse>
{
  constructor(
    private readonly marketingCampaignService: MarketingCampaignService,
    private readonly userAuthService: UserAuthorizationService,
  ) {}

  async execute(command: UpdateMarketingCampaignCommand): Promise<IMarketingCampaignResponse> {
    const { id, dto, currentUserId } = command;

    const currentUser = await this.userAuthService.getCurrentUserSafely(currentUserId);

    const campaign = await this.marketingCampaignService.updateMarketingCampaign(
      id,
      dto.referenceName,
      dto.context,
      dto.metaId ?? null,
      dto.promotionPictureId ?? null,
      currentUser,
    );

    return MarketingCampaignMapper.toResponse(campaign);
  }
}
