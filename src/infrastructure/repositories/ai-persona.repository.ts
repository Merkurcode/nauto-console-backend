import { Inject, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { BaseRepository } from './base.repository';
import { AIPersona } from '@core/entities/ai-persona.entity';
import { IAIPersonaRepository } from '@core/repositories/ai-persona.repository.interface';
import { AIPersonaName } from '@core/value-objects/ai-persona-name.vo';
import { AIPersonaKeyName } from '@core/value-objects/ai-persona-key-name.vo';
import { AIPersonaTone } from '@core/value-objects/ai-persona-tone.vo';
import { AIPersonaPersonality } from '@core/value-objects/ai-persona-personality.vo';
import { AIPersonaObjective } from '@core/value-objects/ai-persona-objective.vo';
import { AIPersonaShortDetails } from '@core/value-objects/ai-persona-short-details.vo';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { RequestCacheService } from '@infrastructure/caching/request-cache.service';

@Injectable()
export class AIPersonaRepository extends BaseRepository<AIPersona> implements IAIPersonaRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionContext: TransactionContextService,
    @Optional() @Inject(LOGGER_SERVICE) private readonly logger?: ILogger,
    @Optional() _requestCache?: RequestCacheService,
  ) {
    logger?.setContext(AIPersonaRepository.name);
    super(logger, undefined);
  }

  private get client() {
    const client = this.transactionContext.getTransactionClient() || this.prisma;
    if (!client) {
      throw new Error('Prisma client is not available. Check dependency injection.');
    }

    return client;
  }

  async findById(id: string): Promise<AIPersona | null> {
    return this.executeWithErrorHandling('findById', async () => {
      const record = await this.client.aIPersona.findUnique({
        where: { id },
        include: {
          company: true,
          creator: true,
          updater: true,
        },
      });

      return record ? this.mapToModel(record) : null;
    });
  }

  async findByKeyName(keyName: string, companyId?: string | null): Promise<AIPersona | null> {
    return this.executeWithErrorHandling('findByKeyName', async () => {
      const record = await this.client.aIPersona.findFirst({
        where: {
          keyName,
          companyId: companyId || null,
        },
        include: {
          company: true,
          creator: true,
          updater: true,
        },
      });

      return record ? this.mapToModel(record) : null;
    });
  }

  async findAllDefault(): Promise<AIPersona[]> {
    return this.executeWithErrorHandling('findAllDefault', async () => {
      const records = await this.client.aIPersona.findMany({
        where: {
          isDefault: true,
          isActive: true,
        },
        include: {
          company: true,
          creator: true,
          updater: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      return records.map(record => this.mapToModel(record));
    });
  }

  async findAllByCompany(companyId: string): Promise<AIPersona[]> {
    return this.executeWithErrorHandling(
      'findOnlyCompanyPersonas',
      async () => {
        const records = await this.client.aIPersona.findMany({
          where: {
            companyId,
            isActive: true,
          },
          include: {
            company: true,
            creator: true,
            updater: true,
          },
          orderBy: [{ name: 'asc' }],
        });

        return records.map(record => this.mapToModel(record));
      },
      undefined,
      { companyId },
    );
  }

  async findAll(filters?: {
    isActive?: boolean;
    isDefault?: boolean;
    companyId?: string;
    userCompanyId?: string;
  }): Promise<AIPersona[]> {
    return this.executeWithErrorHandling('findAll', async () => {
      let where: Record<string, unknown> = {};

      if (filters?.isActive !== undefined) {
        where.isActive = filters.isActive;
      }

      if (filters?.isDefault !== undefined) {
        where.isDefault = filters.isDefault;
      }

      if (filters?.companyId !== undefined) {
        where.companyId = filters.companyId;
      }

      // Special handling for userCompanyId: show default personas + user's company personas
      if (filters?.userCompanyId !== undefined) {
        where = {
          ...where,
          OR: [
            { isDefault: true }, // Default personas (available to all)
            { companyId: filters.userCompanyId }, // User's company personas
          ],
        };
      }

      const records = await this.client.aIPersona.findMany({
        where,
        include: {
          company: true,
          creator: true,
          updater: true,
        },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      });

      return records.map(record => this.mapToModel(record));
    });
  }

  async save(persona: AIPersona): Promise<AIPersona> {
    return this.executeWithErrorHandling('save', async () => {
      const data = this.mapToPersistence(persona);

      const created = await this.client.aIPersona.create({
        data: {
          ...data,
          tone: data.tone as Record<string, string>,
          personality: data.personality as Record<string, string>,
          objective: data.objective as Record<string, string>,
          shortDetails: data.shortDetails as Record<string, string>,
        },
        include: {
          company: true,
          creator: true,
          updater: true,
        },
      });

      return this.mapToModel(created);
    });
  }

  async update(persona: AIPersona): Promise<AIPersona> {
    return this.executeWithErrorHandling('update', async () => {
      const data = this.mapToPersistence(persona);

      const updated = await this.client.aIPersona.update({
        where: { id: persona.id },
        data: {
          tone: data.tone as Record<string, string>,
          personality: data.personality as Record<string, string>,
          objective: data.objective as Record<string, string>,
          shortDetails: data.shortDetails as Record<string, string>,
          isActive: data.isActive as boolean,
          updatedBy: data.updatedBy as string | null,
          updatedAt: data.updatedAt as Date,
        },
        include: {
          company: true,
          creator: true,
          updater: true,
        },
      });

      return this.mapToModel(updated);
    });
  }

  async delete(id: string): Promise<boolean> {
    return this.executeWithErrorHandling('delete', async () => {
      await this.client.aIPersona.delete({
        where: { id },
      });

      return true;
    });
  }

  async existsByKeyName(
    keyName: string,
    companyId?: string | null,
    excludeId?: string,
  ): Promise<boolean> {
    return this.executeWithErrorHandling('existsByKeyName', async () => {
      const count = await this.client.aIPersona.count({
        where: {
          keyName,
          companyId: companyId || null,
          ...(excludeId && { NOT: { id: excludeId } }),
        },
      });

      return count > 0;
    });
  }

  private mapToModel(record: Record<string, unknown>): AIPersona {
    return AIPersona.fromPersistence(record.id as string, {
      name: AIPersonaName.fromString(record.name as string),
      keyName: AIPersonaKeyName.fromString(record.keyName as string),
      tone: AIPersonaTone.create(record.tone as Record<string, string>),
      personality: AIPersonaPersonality.create(record.personality as Record<string, string>),
      objective: AIPersonaObjective.create(record.objective as Record<string, string>),
      shortDetails: AIPersonaShortDetails.create(record.shortDetails as Record<string, string>),
      isDefault: record.isDefault as boolean,
      companyId: record.companyId as string | null,
      isActive: record.isActive as boolean,
      createdBy: record.createdBy as string | null,
      updatedBy: record.updatedBy as string | null,
      createdAt: record.createdAt as Date,
      updatedAt: record.updatedAt as Date,
    });
  }

  private mapToPersistence(persona: AIPersona) {
    return {
      id: persona.id,
      name: persona.name.getValue(),
      keyName: persona.keyName.getValue(),
      tone: persona.tone.getValue() as Record<string, string>,
      personality: persona.personality.getValue() as Record<string, string>,
      objective: persona.objective.getValue() as Record<string, string>,
      shortDetails: persona.shortDetails.getValue() as Record<string, string>,
      isDefault: persona.isDefault,
      companyId: persona.companyId,
      isActive: persona.isActive,
      createdBy: persona.createdBy,
      updatedBy: persona.updatedBy,
      createdAt: persona.createdAt,
      updatedAt: persona.updatedAt,
    };
  }
}
