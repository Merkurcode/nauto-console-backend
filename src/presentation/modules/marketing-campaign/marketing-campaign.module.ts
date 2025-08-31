import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CoreModule } from '@core/core.module';
import { MarketingCampaignController } from './marketing-campaign.controller';

// Command Handlers
import { CreateMarketingCampaignHandler } from '@application/commands/marketing-campaign/create-marketing-campaign.command';
import { UpdateMarketingCampaignHandler } from '@application/commands/marketing-campaign/update-marketing-campaign.command';
import { EnableMarketingCampaignHandler } from '@application/commands/marketing-campaign/enable-marketing-campaign.command';
import { DisableMarketingCampaignHandler } from '@application/commands/marketing-campaign/disable-marketing-campaign.command';
import { DeleteMarketingCampaignHandler } from '@application/commands/marketing-campaign/delete-marketing-campaign.command';

// Query Handlers
import { GetMarketingCampaignHandler } from '@application/queries/marketing-campaign/get-marketing-campaign.query';
import { GetCompanyMarketingCampaignsHandler } from '@application/queries/marketing-campaign/get-company-marketing-campaigns.query';
import { GetActiveMarketingCampaignsHandler } from '@application/queries/marketing-campaign/get-active-marketing-campaigns.query';

@Module({
  imports: [CqrsModule, CoreModule],
  controllers: [MarketingCampaignController],
  providers: [
    // Command Handlers
    CreateMarketingCampaignHandler,
    UpdateMarketingCampaignHandler,
    EnableMarketingCampaignHandler,
    DisableMarketingCampaignHandler,
    DeleteMarketingCampaignHandler,
    // Query Handlers
    GetMarketingCampaignHandler,
    GetCompanyMarketingCampaignsHandler,
    GetActiveMarketingCampaignsHandler,
  ],
  exports: [],
})
export class MarketingCampaignModule {}
