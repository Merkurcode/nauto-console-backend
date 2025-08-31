import { Injectable, Inject } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { MarketingCampaign } from '@core/entities/marketing-campaign.entity';
import { IMarketingCampaignRepository } from '@core/repositories/marketing-campaign.repository.interface';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { User } from '@core/entities/user.entity';
import { UTMName } from '@core/value-objects/marketing-campaign/utm-name.vo';
import { ReferenceName } from '@core/value-objects/marketing-campaign/reference-name.vo';
import { CampaignContext } from '@core/value-objects/marketing-campaign/campaign-context.vo';
import { MetaId } from '@core/value-objects/marketing-campaign/meta-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import {
  MarketingCampaignNotFoundException,
  MarketingCampaignUTMNameAlreadyExistsException,
  UnauthorizedCampaignAccessException,
} from '@core/exceptions/marketing-campaign.exceptions';
import { REPOSITORY_TOKENS, LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { MarketingCampaignDeletedEvent } from '@core/events/marketing-campaign.events';

@Injectable()
export class MarketingCampaignService {
  constructor(
    @Inject(REPOSITORY_TOKENS.MARKETING_CAMPAIGN_REPOSITORY)
    private readonly marketingCampaignRepository: IMarketingCampaignRepository,
    private readonly userAuthService: UserAuthorizationService,
    private readonly eventBus: EventBus,
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
  ) {
    this.logger.setContext(MarketingCampaignService.name);
  }

  async createMarketingCampaign(
    startDate: Date,
    endDate: Date,
    referenceName: string,
    context: string,
    companyId: string,
    currentUser: User,
    metaId: string | null = null,
    promotionPictureId: string | null = null,
  ): Promise<MarketingCampaign> {
    // Security Measure: Validate user can access the company
    if (!this.userAuthService.canAccessCompany(currentUser, companyId)) {
      throw new UnauthorizedCampaignAccessException('new', companyId);
    }

    // Security Measure: Log campaign creation
    this.logger.log(
      `User ${currentUser.id.getValue()} creating marketing campaign for company ${companyId}`,
    );

    const referenceNameVO = ReferenceName.create(referenceName);
    const utmName = UTMName.create(referenceName);

    // Check if UTM name already exists
    const existingCampaign = await this.marketingCampaignRepository.findByUTMName(
      utmName.getValue(),
    );
    if (existingCampaign) {
      throw new MarketingCampaignUTMNameAlreadyExistsException(utmName.getValue());
    }

    const campaign = MarketingCampaign.create(
      startDate,
      endDate,
      referenceNameVO,
      CampaignContext.create(context),
      CompanyId.fromString(companyId),
      currentUser.id,
      metaId ? MetaId.create(metaId) : null,
      promotionPictureId,
    );

    const savedCampaign = await this.marketingCampaignRepository.create(campaign);

    // Publish domain events
    for (const event of campaign.getDomainEvents()) {
      await this.eventBus.publish(event);
    }
    campaign.clearDomainEvents();

    return savedCampaign;
  }

  async updateMarketingCampaign(
    id: string,
    referenceName: string,
    context: string,
    metaId: string | null,
    promotionPictureId: string | null,
    currentUser: User,
  ): Promise<MarketingCampaign> {
    const campaign = await this.validateCampaignAccess(id, currentUser);

    // Security Measure: Log campaign update
    this.logger.log(`User ${currentUser.id.getValue()} updating marketing campaign ${id}`);

    campaign.update(
      ReferenceName.create(referenceName),
      CampaignContext.create(context),
      MetaId.create(metaId),
      promotionPictureId,
      currentUser.id,
    );

    const updatedCampaign = await this.marketingCampaignRepository.update(campaign);

    // Publish domain events
    for (const event of campaign.getDomainEvents()) {
      await this.eventBus.publish(event);
    }
    campaign.clearDomainEvents();

    return updatedCampaign;
  }

  async enableCampaign(id: string, currentUser: User): Promise<MarketingCampaign> {
    const campaign = await this.validateCampaignAccess(id, currentUser);

    // Security Measure: Log sensitive operation
    this.logger.warn(`User ${currentUser.id.getValue()} enabling marketing campaign ${id}`);

    campaign.enable(currentUser.id);

    const updatedCampaign = await this.marketingCampaignRepository.update(campaign);

    // Publish domain events
    for (const event of campaign.getDomainEvents()) {
      await this.eventBus.publish(event);
    }
    campaign.clearDomainEvents();

    return updatedCampaign;
  }

  async disableCampaign(id: string, currentUser: User): Promise<MarketingCampaign> {
    const campaign = await this.validateCampaignAccess(id, currentUser);

    // Security Measure: Log sensitive operation
    this.logger.warn(`User ${currentUser.id.getValue()} disabling marketing campaign ${id}`);

    campaign.disable(currentUser.id);

    const updatedCampaign = await this.marketingCampaignRepository.update(campaign);

    // Publish domain events
    for (const event of campaign.getDomainEvents()) {
      await this.eventBus.publish(event);
    }
    campaign.clearDomainEvents();

    return updatedCampaign;
  }

  async deleteCampaign(id: string, currentUser: User): Promise<boolean> {
    const campaign = await this.validateCampaignAccess(id, currentUser);

    // Security Measure: Log deletion operation
    this.logger.warn(`User ${currentUser.id.getValue()} deleting marketing campaign ${id}`);

    const deleted = await this.marketingCampaignRepository.delete(id);

    if (deleted) {
      // Publish deletion event
      const deleteEvent = new MarketingCampaignDeletedEvent(
        id,
        campaign.companyId.getValue(),
        currentUser.id.getValue(),
      );
      await this.eventBus.publish(deleteEvent);
    }

    return deleted;
  }

  async getCompanyCampaigns(companyId: string, currentUser: User): Promise<MarketingCampaign[]> {
    // Security Measure: Validate user can access the company
    if (!this.userAuthService.canAccessCompany(currentUser, companyId)) {
      this.logger.warn(
        `User ${currentUser.id.getValue()} attempted unauthorized access to company ${companyId} campaigns`,
      );

      return [];
    }

    return this.marketingCampaignRepository.findAllByCompanyId(companyId);
  }

  async getActiveCampaigns(companyId: string, currentUser: User): Promise<MarketingCampaign[]> {
    // Security Measure: Validate user can access the company
    if (!this.userAuthService.canAccessCompany(currentUser, companyId)) {
      this.logger.warn(
        `User ${currentUser.id.getValue()} attempted unauthorized access to company ${companyId} active campaigns`,
      );

      return [];
    }

    return this.marketingCampaignRepository.findActiveByCompanyId(companyId);
  }

  async getCampaignById(id: string, currentUser: User): Promise<MarketingCampaign> {
    return this.validateCampaignAccess(id, currentUser);
  }

  private async validateCampaignAccess(id: string, currentUser: User): Promise<MarketingCampaign> {
    const campaign = await this.marketingCampaignRepository.findById(id);

    if (!campaign) {
      throw new MarketingCampaignNotFoundException(id);
    }

    // Security Measure: Validate user can access the campaign's company
    if (!this.userAuthService.canAccessCompany(currentUser, campaign.companyId.getValue())) {
      throw new UnauthorizedCampaignAccessException(id, campaign.companyId.getValue());
    }

    return campaign;
  }
}
