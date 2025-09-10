import { Injectable, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { BaseRepository } from './base.repository';
import { AIAssistant, IAIAssistantProps } from '@core/entities/ai-assistant.entity';
import { IAIAssistantRepository } from '@core/repositories/ai-assistant.repository.interface';
import { AssistantAreaEnum } from '@shared/constants/enums';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { RequestCacheService } from '@infrastructure/caching/request-cache.service';
import {
  IPrismaAIAssistantData,
  IPrismaAIAssistantFeature,
} from '@core/interfaces/repositories/prisma-data.interface';

@Injectable()
export class AIAssistantRepository
  extends BaseRepository<AIAssistant>
  implements IAIAssistantRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionContext: TransactionContextService,
    @Optional() @Inject(LOGGER_SERVICE) private readonly logger?: ILogger,
    @Optional() _requestCache?: RequestCacheService,
  ) {
    logger?.setContext(AIAssistantRepository.name);
    super(logger, undefined);
  }

  private get client() {
    return this.transactionContext.getTransactionClient() || this.prisma;
  }

  async findAllAvailable(): Promise<AIAssistant[]> {
    return this.executeWithErrorHandling('findAllAvailable', async () => {
      const assistants = await this.client.aIAssistant.findMany({
        where: {
          available: true,
        },
        include: {
          features: true,
        },
      });

      return assistants.map(assistant => this.mapToModel(assistant));
    });
  }

  async findById(id: string): Promise<AIAssistant | null> {
    return this.executeWithErrorHandling('findById', async () => {
      const assistant = await this.client.aIAssistant.findUnique({
        where: { id },
        include: {
          features: true,
        },
      });

      return assistant ? this.mapToModel(assistant) : null;
    });
  }

  async findByIds(ids: string[]): Promise<AIAssistant[]> {
    return this.executeWithErrorHandling('findByIds', async () => {
      const assistants = await this.client.aIAssistant.findMany({
        where: {
          id: { in: ids },
        },
        include: {
          features: true,
        },
      });

      return assistants.map(assistant => this.mapToModel(assistant));
    });
  }

  async findByIdWithFeatures(id: string): Promise<AIAssistant | null> {
    return this.executeWithErrorHandling('findByIdWithFeatures', async () => {
      const assistant = await this.prisma.aIAssistant.findUnique({
        where: { id },
        include: {
          features: true,
        },
      });

      return assistant ? this.mapToModel(assistant) : null;
    });
  }

  async findByName(name: string): Promise<AIAssistant | null> {
    return this.executeWithErrorHandling('findByName', async () => {
      const assistant = await this.prisma.aIAssistant.findFirst({
        where: { name },
        include: {
          features: true,
        },
      });

      return assistant ? this.mapToModel(assistant) : null;
    });
  }

  async findByNameWithFeatures(name: string): Promise<AIAssistant | null> {
    return this.executeWithErrorHandling('findByNameWithFeatures', async () => {
      const assistant = await this.prisma.aIAssistant.findFirst({
        where: { name },
        include: {
          features: true,
        },
      });

      return assistant ? this.mapToModel(assistant) : null;
    });
  }

  private mapToModel(data: IPrismaAIAssistantData): AIAssistant {
    const props: IAIAssistantProps = {
      id: data.id,
      name: data.name,
      area: data.area as AssistantAreaEnum,
      available: data.available,
      description: this.parseJsonAsRecord(data.description),
      features: data.features.map((feature: IPrismaAIAssistantFeature) => ({
        id: feature.id,
        keyName: feature.keyName,
        title: this.parseJsonAsRecord(feature.title),
        description: this.parseJsonAsRecord(feature.description),
      })),
      createdAt: data.createdAt as Date,
      updatedAt: data.updatedAt as Date,
    };

    return new AIAssistant(props);
  }

  private parseJsonAsRecord(jsonValue: unknown): Record<string, string> {
    if (typeof jsonValue === 'object' && jsonValue !== null && !Array.isArray(jsonValue)) {
      return jsonValue as Record<string, string>;
    }

    return {};
  }
}
