import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { IMarketingCampaignResponse } from '@application/dtos/_responses/marketing-campaign/marketing-campaign.response.interface';
import { MarketingCampaignService } from '@core/services/marketing-campaign.service';
import { MarketingCampaignMapper } from '@application/mappers/marketing-campaign.mapper';
import { UserAuthorizationService } from '@core/services/user-authorization.service';

export class GetMarketingCampaignQuery implements IQuery {
  constructor(
    public readonly id: string,
    public readonly currentUserId: string,
  ) {}
}

@QueryHandler(GetMarketingCampaignQuery)
export class GetMarketingCampaignHandler
  implements IQueryHandler<GetMarketingCampaignQuery, IMarketingCampaignResponse>
{
  constructor(
    private readonly marketingCampaignService: MarketingCampaignService,
    private readonly userAuthService: UserAuthorizationService,
  ) {}

  async execute(query: GetMarketingCampaignQuery): Promise<IMarketingCampaignResponse> {
    const { id, currentUserId } = query;

    const currentUser = await this.userAuthService.getCurrentUserSafely(currentUserId);

    const campaign = await this.marketingCampaignService.getCampaignById(id, currentUser);

    return MarketingCampaignMapper.toResponse(campaign);
  }
}
