import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateMarketingCampaignDto } from '@application/dtos/marketing-campaign/create-marketing-campaign.dto';
import { IMarketingCampaignResponse } from '@application/dtos/_responses/marketing-campaign/marketing-campaign.response.interface';
import { MarketingCampaignService } from '@core/services/marketing-campaign.service';
import { MarketingCampaignMapper } from '@application/mappers/marketing-campaign.mapper';
import { UserAuthorizationService } from '@core/services/user-authorization.service';

export class CreateMarketingCampaignCommand implements ICommand {
  constructor(
    public readonly dto: CreateMarketingCampaignDto,
    public readonly currentUserId: string,
  ) {}
}

@CommandHandler(CreateMarketingCampaignCommand)
export class CreateMarketingCampaignHandler
  implements ICommandHandler<CreateMarketingCampaignCommand, IMarketingCampaignResponse>
{
  constructor(
    private readonly marketingCampaignService: MarketingCampaignService,
    private readonly userAuthService: UserAuthorizationService,
  ) {}

  async execute(command: CreateMarketingCampaignCommand): Promise<IMarketingCampaignResponse> {
    const { dto, currentUserId } = command;

    const currentUser = await this.userAuthService.getCurrentUserSafely(currentUserId);

    const campaign = await this.marketingCampaignService.createMarketingCampaign(
      new Date(dto.startDate),
      new Date(dto.endDate),
      dto.referenceName,
      dto.context,
      dto.companyId,
      currentUser,
      dto.metaId || null,
      dto.promotionPictureId || null,
    );

    return MarketingCampaignMapper.toResponse(campaign);
  }
}
