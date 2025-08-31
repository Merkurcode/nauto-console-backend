import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { IMarketingCampaignResponse } from '@application/dtos/_responses/marketing-campaign/marketing-campaign.response.interface';
import { MarketingCampaignService } from '@core/services/marketing-campaign.service';
import { MarketingCampaignMapper } from '@application/mappers/marketing-campaign.mapper';
import { UserAuthorizationService } from '@core/services/user-authorization.service';

export class GetCompanyMarketingCampaignsQuery implements IQuery {
  constructor(
    public readonly companyId: string,
    public readonly currentUserId: string,
  ) {}
}

@QueryHandler(GetCompanyMarketingCampaignsQuery)
export class GetCompanyMarketingCampaignsHandler
  implements IQueryHandler<GetCompanyMarketingCampaignsQuery, IMarketingCampaignResponse[]>
{
  constructor(
    private readonly marketingCampaignService: MarketingCampaignService,
    private readonly userAuthService: UserAuthorizationService,
  ) {}

  async execute(query: GetCompanyMarketingCampaignsQuery): Promise<IMarketingCampaignResponse[]> {
    const { companyId, currentUserId } = query;

    const currentUser = await this.userAuthService.getCurrentUserSafely(currentUserId);

    const campaigns = await this.marketingCampaignService.getCompanyCampaigns(
      companyId,
      currentUser,
    );

    return MarketingCampaignMapper.toResponseArray(campaigns);
  }
}
