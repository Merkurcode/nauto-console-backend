import { Injectable, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { BaseRepository } from './base.repository';
import { AIAssistant, IAIAssistantProps } from '@core/entities/ai-assistant.entity';
import { IAIAssistantRepository } from '@core/repositories/ai-assistant.repository.interface';
import { AssistantAreaEnum } from '@shared/constants/enums';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';

@Injectable()
export class AIAssistantRepository
  extends BaseRepository<AIAssistant>
  implements IAIAssistantRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionContext: TransactionContextService,
    @Optional() @Inject(LOGGER_SERVICE) logger?: ILogger,
  ) {
    super(logger);
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

  private mapToModel(data: Record<string, unknown>): AIAssistant {
    const props: IAIAssistantProps = {
      id: data.id as string,
      name: data.name as string,
      area: data.area as AssistantAreaEnum,
      available: data.available as boolean,
      description: data.description as Record<string, string>,
      features: (data.features as Record<string, unknown>[]).map(feature => ({
        id: feature.id as string,
        keyName: feature.keyName as string,
        title: feature.title as Record<string, string>,
        description: feature.description as Record<string, string>,
      })),
      createdAt: data.createdAt as Date,
      updatedAt: data.updatedAt as Date,
    };

    return new AIAssistant(props);
  }
}
