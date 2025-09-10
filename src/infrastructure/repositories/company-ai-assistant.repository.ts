import { Injectable, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { BaseRepository } from './base.repository';
import {
  CompanyAIAssistant,
  ICompanyAIAssistantProps,
} from '@core/entities/company-ai-assistant.entity';
import { ICompanyAIAssistantRepository } from '@core/repositories/company-ai-assistant.repository.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { RequestCacheService } from '@infrastructure/caching/request-cache.service';
import {
  IPrismaCompanyAIAssistantData,
  IPrismaCompanyAIAssistantFeature,
} from '@core/interfaces/repositories/prisma-data.interface';

@Injectable()
export class CompanyAIAssistantRepository
  extends BaseRepository<CompanyAIAssistant>
  implements ICompanyAIAssistantRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionContext: TransactionContextService,
    @Optional() @Inject(LOGGER_SERVICE) private readonly logger?: ILogger,
    @Optional() _requestCache?: RequestCacheService,
  ) {
    logger?.setContext(CompanyAIAssistantRepository.name);
    super(logger, undefined);
  }

  private get client() {
    return this.transactionContext.getTransactionClient() || this.prisma;
  }

  async findByCompanyId(companyId: string): Promise<CompanyAIAssistant[]> {
    return this.executeWithErrorHandling('findByCompanyId', async () => {
      const assignments = await this.client.companyAIAssistant.findMany({
        where: { companyId },
        include: {
          features: true,
        },
      });

      return assignments.map(assignment => this.mapToModel(assignment));
    });
  }

  async findByCompanyIdAndAssistantId(
    companyId: string,
    assistantId: string,
  ): Promise<CompanyAIAssistant | null> {
    return this.executeWithErrorHandling('findByCompanyIdAndAssistantId', async () => {
      const assignment = await this.client.companyAIAssistant.findUnique({
        where: {
          companyId_aiAssistantId: {
            companyId,
            aiAssistantId: assistantId,
          },
        },
        include: {
          features: true,
        },
      });

      return assignment ? this.mapToModel(assignment) : null;
    });
  }

  async create(assignment: CompanyAIAssistant): Promise<CompanyAIAssistant> {
    return this.executeWithErrorHandling('create', async () => {
      const created = await this.client.companyAIAssistant.create({
        data: {
          companyId: assignment.companyId,
          aiAssistantId: assignment.aiAssistantId,
          enabled: assignment.enabled,
          features: {
            create: assignment.features.map(feature => ({
              featureId: feature.featureId,
              enabled: feature.enabled,
            })),
          },
        },
        include: {
          features: true,
        },
      });

      return this.mapToModel(created);
    });
  }

  async update(assignment: CompanyAIAssistant): Promise<CompanyAIAssistant> {
    return this.executeWithErrorHandling('update', async () => {
      // Get existing features
      const existingFeatures = await this.client.companyAIAssistantFeature.findMany({
        where: { assignmentId: assignment.id },
      });

      // Update assignment first
      await this.client.companyAIAssistant.update({
        where: { id: assignment.id },
        data: {
          enabled: assignment.enabled,
          updatedAt: assignment.updatedAt,
        },
      });

      // Handle features: update existing, create new ones
      for (const feature of assignment.features) {
        const existingFeature = existingFeatures.find(ef => ef.featureId === feature.featureId);

        if (existingFeature) {
          // Update existing feature
          await this.client.companyAIAssistantFeature.update({
            where: { id: existingFeature.id },
            data: {
              enabled: feature.enabled,
            },
          });
        } else {
          // Create new feature
          await this.client.companyAIAssistantFeature.create({
            data: {
              id: feature.id,
              assignmentId: assignment.id,
              featureId: feature.featureId,
              enabled: feature.enabled,
            },
          });
        }
      }

      // Get the updated assignment with features
      const updated = await this.client.companyAIAssistant.findUnique({
        where: { id: assignment.id },
        include: {
          features: true,
        },
      });

      return this.mapToModel(updated!);
    });
  }

  async delete(id: string): Promise<void> {
    return this.executeWithErrorHandling('delete', async () => {
      await this.client.companyAIAssistant.delete({
        where: { id },
      });
    });
  }

  async toggleAssistantStatus(
    companyId: string,
    assistantId: string,
    enabled: boolean,
  ): Promise<CompanyAIAssistant> {
    return this.executeWithErrorHandling('toggleAssistantStatus', async () => {
      const updated = await this.client.companyAIAssistant.update({
        where: {
          companyId_aiAssistantId: {
            companyId,
            aiAssistantId: assistantId,
          },
        },
        data: {
          enabled,
          updatedAt: new Date(),
        },
        include: {
          features: true,
        },
      });

      return this.mapToModel(updated);
    });
  }

  async toggleFeatureStatus(
    assignmentId: string,
    featureId: string,
    enabled: boolean,
  ): Promise<void> {
    return this.executeWithErrorHandling('toggleFeatureStatus', async () => {
      await this.client.companyAIAssistantFeature.update({
        where: {
          assignmentId_featureId: {
            assignmentId,
            featureId,
          },
        },
        data: {
          enabled,
          updatedAt: new Date(),
        },
      });
    });
  }

  private mapToModel(data: IPrismaCompanyAIAssistantData): CompanyAIAssistant {
    const props: ICompanyAIAssistantProps = {
      id: data.id,
      companyId: data.companyId,
      aiAssistantId: data.aiAssistantId,
      enabled: data.enabled,
      features: data.features.map((feature: IPrismaCompanyAIAssistantFeature) => ({
        id: feature.id,
        featureId: feature.featureId,
        enabled: feature.enabled,
      })),
      createdAt: data.createdAt as Date,
      updatedAt: data.updatedAt as Date,
    };

    return new CompanyAIAssistant(props);
  }
}
