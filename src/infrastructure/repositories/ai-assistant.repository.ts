import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { AIAssistant, IAIAssistantProps } from '@core/entities/ai-assistant.entity';
import { IAIAssistantRepository } from '@core/repositories/ai-assistant.repository.interface';
import { AssistantAreaEnum } from '@shared/constants/enums';

@Injectable()
export class AIAssistantRepository implements IAIAssistantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllAvailable(): Promise<AIAssistant[]> {
    const assistants = await this.prisma.aIAssistant.findMany({
      where: {
        available: true,
      },
      include: {
        features: true,
      },
    });

    return assistants.map(assistant => this.mapToModel(assistant));
  }

  async findById(id: string): Promise<AIAssistant | null> {
    const assistant = await this.prisma.aIAssistant.findUnique({
      where: { id },
      include: {
        features: true,
      },
    });

    return assistant ? this.mapToModel(assistant) : null;
  }

  async findByIds(ids: string[]): Promise<AIAssistant[]> {
    const assistants = await this.prisma.aIAssistant.findMany({
      where: {
        id: { in: ids },
      },
      include: {
        features: true,
      },
    });

    return assistants.map(assistant => this.mapToModel(assistant));
  }

  async findByIdWithFeatures(id: string): Promise<AIAssistant | null> {
    const assistant = await this.prisma.aIAssistant.findUnique({
      where: { id },
      include: {
        features: true,
      },
    });

    return assistant ? this.mapToModel(assistant) : null;
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
