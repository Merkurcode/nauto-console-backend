import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import {
  CompanyAIAssistant,
  ICompanyAIAssistantProps,
} from '@core/entities/company-ai-assistant.entity';
import { ICompanyAIAssistantRepository } from '@core/repositories/company-ai-assistant.repository.interface';

@Injectable()
export class CompanyAIAssistantRepository implements ICompanyAIAssistantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCompanyId(companyId: string): Promise<CompanyAIAssistant[]> {
    const assignments = await this.prisma.companyAIAssistant.findMany({
      where: { companyId },
      include: {
        features: true,
      },
    });

    return assignments.map(assignment => this.mapToModel(assignment));
  }

  async findByCompanyIdAndAssistantId(
    companyId: string,
    assistantId: string,
  ): Promise<CompanyAIAssistant | null> {
    const assignment = await this.prisma.companyAIAssistant.findUnique({
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
  }

  async create(assignment: CompanyAIAssistant): Promise<CompanyAIAssistant> {
    const created = await this.prisma.companyAIAssistant.create({
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
  }

  async update(assignment: CompanyAIAssistant): Promise<CompanyAIAssistant> {
    const updated = await this.prisma.companyAIAssistant.update({
      where: { id: assignment.id },
      data: {
        enabled: assignment.enabled,
        updatedAt: assignment.updatedAt,
      },
      include: {
        features: true,
      },
    });

    return this.mapToModel(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.companyAIAssistant.delete({
      where: { id },
    });
  }

  async toggleAssistantStatus(
    companyId: string,
    assistantId: string,
    enabled: boolean,
  ): Promise<CompanyAIAssistant> {
    const updated = await this.prisma.companyAIAssistant.update({
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
  }

  async toggleFeatureStatus(
    assignmentId: string,
    featureId: string,
    enabled: boolean,
  ): Promise<void> {
    await this.prisma.companyAIAssistantFeature.update({
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
  }

  private mapToModel(data: Record<string, unknown>): CompanyAIAssistant {
    const props: ICompanyAIAssistantProps = {
      id: data.id as string,
      companyId: data.companyId as string,
      aiAssistantId: data.aiAssistantId as string,
      enabled: data.enabled as boolean,
      features: (data.features as Record<string, unknown>[]).map(feature => ({
        id: feature.id as string,
        featureId: feature.featureId as string,
        enabled: feature.enabled as boolean,
      })),
      createdAt: data.createdAt as Date,
      updatedAt: data.updatedAt as Date,
    };

    return new CompanyAIAssistant(props);
  }
}
