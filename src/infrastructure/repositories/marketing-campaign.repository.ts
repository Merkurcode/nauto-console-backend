import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { BaseRepository } from './base.repository';
import { MarketingCampaign } from '@core/entities/marketing-campaign.entity';
import { IMarketingCampaignRepository } from '@core/repositories/marketing-campaign.repository.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class MarketingCampaignRepository
  extends BaseRepository<MarketingCampaign>
  implements IMarketingCampaignRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionContext: TransactionContextService,
  ) {
    super();
  }

  private get client() {
    return this.transactionContext.getTransactionClient() || this.prisma;
  }

  async findById(id: string): Promise<MarketingCampaign | null> {
    return this.executeWithErrorHandling('findById', async () => {
      const record = await this.client.marketingCampaign.findUnique({
        where: { id },
        include: {
          company: true,
          promotionPicture: true,
          createdByUser: true,
          updatedByUser: true,
        },
      });

      return record ? this.mapToModel(record) : null;
    });
  }

  async findByUTMName(utmName: string): Promise<MarketingCampaign | null> {
    return this.executeWithErrorHandling('findByUTMName', async () => {
      const record = await this.client.marketingCampaign.findUnique({
        where: { utmName },
        include: {
          company: true,
          promotionPicture: true,
          createdByUser: true,
          updatedByUser: true,
        },
      });

      return record ? this.mapToModel(record) : null;
    });
  }

  async findAllByCompanyId(companyId: string): Promise<MarketingCampaign[]> {
    return this.executeWithErrorHandling('findAllByCompanyId', async () => {
      const records = await this.client.marketingCampaign.findMany({
        where: { companyId },
        include: {
          company: true,
          promotionPicture: true,
          createdByUser: true,
          updatedByUser: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return records.map(record => this.mapToModel(record));
    });
  }

  async findActiveByCompanyId(companyId: string): Promise<MarketingCampaign[]> {
    return this.executeWithErrorHandling('findActiveByCompanyId', async () => {
      const now = new Date();

      const records = await this.client.marketingCampaign.findMany({
        where: {
          companyId,
          enabled: true,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        include: {
          company: true,
          promotionPicture: true,
          createdByUser: true,
          updatedByUser: true,
        },
        orderBy: { startDate: 'asc' },
      });

      return records.map(record => this.mapToModel(record));
    });
  }

  async create(campaign: MarketingCampaign): Promise<MarketingCampaign> {
    return this.executeWithErrorHandling('create', async () => {
      const data = this.mapToPersistence(campaign);

      const created = await this.client.marketingCampaign.create({
        data,
        include: {
          company: true,
          promotionPicture: true,
          createdByUser: true,
          updatedByUser: true,
        },
      });

      return this.mapToModel(created);
    });
  }

  async update(campaign: MarketingCampaign): Promise<MarketingCampaign> {
    return this.executeWithErrorHandling('update', async () => {
      const data = this.mapToPersistenceForUpdate(campaign);

      const updated = await this.client.marketingCampaign.update({
        where: { id: campaign.id },
        data,
        include: {
          company: true,
          promotionPicture: true,
          createdByUser: true,
          updatedByUser: true,
        },
      });

      return this.mapToModel(updated);
    });
  }

  async delete(id: string): Promise<boolean> {
    return this.executeWithErrorHandling('delete', async () => {
      try {
        await this.client.marketingCampaign.delete({
          where: { id },
        });

        return true;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          return false; // Record not found
        }
        throw error;
      }
    });
  }

  async existsByUTMName(utmName: string): Promise<boolean> {
    return this.executeWithErrorHandling('existsByUTMName', async () => {
      const count = await this.client.marketingCampaign.count({
        where: { utmName },
      });

      return count > 0;
    });
  }

  private mapToModel(record: any): MarketingCampaign {
    return MarketingCampaign.fromPersistence(
      record.id,
      record.startDate,
      record.endDate,
      record.utmName,
      record.referenceName,
      record.context,
      record.enabled,
      record.metaId,
      record.promotionPictureId,
      record.companyId,
      record.createdBy,
      record.updatedBy,
      record.createdAt,
      record.updatedAt,
    );
  }

  private mapToPersistence(campaign: MarketingCampaign): Prisma.MarketingCampaignCreateInput {
    return {
      id: campaign.id,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      utmName: campaign.utmName.getValue(),
      referenceName: campaign.referenceName.getValue(),
      context: campaign.context.getValue(),
      enabled: campaign.enabled,
      metaId: campaign.metaId.getValue(),
      company: { connect: { id: campaign.companyId.getValue() } },
      createdByUser: { connect: { id: campaign.createdBy.getValue() } },
      updatedByUser: { connect: { id: campaign.updatedBy.getValue() } },
      ...(campaign.promotionPictureId && {
        promotionPicture: { connect: { id: campaign.promotionPictureId } },
      }),
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  }

  private mapToPersistenceForUpdate(
    campaign: MarketingCampaign,
  ): Prisma.MarketingCampaignUpdateInput {
    return {
      referenceName: campaign.referenceName.getValue(),
      context: campaign.context.getValue(),
      enabled: campaign.enabled,
      metaId: campaign.metaId.getValue(),
      updatedByUser: { connect: { id: campaign.updatedBy.getValue() } },
      ...(campaign.promotionPictureId && {
        promotionPicture: { connect: { id: campaign.promotionPictureId } },
      }),
      updatedAt: campaign.updatedAt,
    };
  }
}
