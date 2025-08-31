import { MarketingCampaign } from '@core/entities/marketing-campaign.entity';
import { IMarketingCampaignResponse } from '@application/dtos/_responses/marketing-campaign/marketing-campaign.response.interface';

export class MarketingCampaignMapper {
  public static toResponse(campaign: MarketingCampaign): IMarketingCampaignResponse {
    return {
      id: campaign.id,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      utmName: campaign.utmName.getValue(),
      referenceName: campaign.referenceName.getValue(),
      context: campaign.context.getValue(),
      enabled: campaign.enabled,
      metaId: campaign.metaId.getValue(),
      promotionPictureId: campaign.promotionPictureId,
      companyId: campaign.companyId.getValue(),
      createdBy: campaign.createdBy.getValue(),
      updatedBy: campaign.updatedBy.getValue(),
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      isActive: campaign.isActive(),
    };
  }

  public static toResponseArray(campaigns: MarketingCampaign[]): IMarketingCampaignResponse[] {
    return campaigns.map(campaign => this.toResponse(campaign));
  }
}
