import { MarketingCampaign } from '@core/entities/marketing-campaign.entity';

/**
 * Marketing Campaign repository interface
 *
 * Implementations:
 * - {@link MarketingCampaign} - Production Prisma/PostgreSQL implementation
 */
export interface IMarketingCampaignRepository {
  findById(id: string): Promise<MarketingCampaign | null>;
  findByUTMName(utmName: string): Promise<MarketingCampaign | null>;
  findAllByCompanyId(companyId: string): Promise<MarketingCampaign[]>;
  findActiveByCompanyId(companyId: string): Promise<MarketingCampaign[]>;
  create(campaign: MarketingCampaign): Promise<MarketingCampaign>;
  update(campaign: MarketingCampaign): Promise<MarketingCampaign>;
  delete(id: string): Promise<boolean>;
  existsByUTMName(utmName: string): Promise<boolean>;
}
