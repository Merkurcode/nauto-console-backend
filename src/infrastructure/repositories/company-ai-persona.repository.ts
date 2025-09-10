import { Inject, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { BaseRepository } from './base.repository';
import {
  ICompanyAIPersonaRepository,
  ICompanyAIPersonaAssignment,
} from '@core/repositories/company-ai-persona.repository.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { RequestCacheService } from '@infrastructure/caching/request-cache.service';

@Injectable()
export class CompanyAIPersonaRepository
  extends BaseRepository<ICompanyAIPersonaAssignment>
  implements ICompanyAIPersonaRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionContext: TransactionContextService,
    @Optional() @Inject(LOGGER_SERVICE) private readonly logger?: ILogger,
    @Optional() _requestCache?: RequestCacheService,
  ) {
    logger?.setContext(CompanyAIPersonaRepository.name);
    super(logger, undefined);
  }

  private get client() {
    return this.transactionContext.getTransactionClient() || this.prisma;
  }

  async findByCompanyId(companyId: string): Promise<ICompanyAIPersonaAssignment | null> {
    return this.executeWithErrorHandling('findByCompanyId', async () => {
      const record = await this.client.companyAIPersona.findUnique({
        where: { companyId },
      });

      return record ? this.mapToModel(record) : null;
    });
  }

  async assignAIPersonaToCompany(
    companyId: string,
    aiPersonaId: string,
    assignedBy: string,
  ): Promise<ICompanyAIPersonaAssignment> {
    return this.executeWithErrorHandling('assignPersonaToCompany', async () => {
      const record = await this.client.companyAIPersona.upsert({
        where: { companyId },
        update: {
          aiPersonaId,
          /*isActive: true,
          assignedAt: new Date(),
          assignedBy,*/
        },
        create: {
          companyId,
          aiPersonaId,
          isActive: true,
          assignedBy,
        },
      });

      return this.mapToModel(record);
    });
  }

  async deactivateCompanyAIPersona(companyId: string): Promise<boolean> {
    return this.executeWithErrorHandling('deactivateCompanyPersona', async () => {
      await this.client.companyAIPersona.update({
        where: { companyId },
        data: { isActive: false },
      });

      return true;
    });
  }

  async removeCompanyAIPersona(companyId: string): Promise<boolean> {
    return this.executeWithErrorHandling('removeCompanyPersona', async () => {
      await this.client.companyAIPersona.delete({
        where: { companyId },
      });

      return true;
    });
  }

  async findAllByAIPersonaId(aiPersonaId: string): Promise<ICompanyAIPersonaAssignment[]> {
    return this.executeWithErrorHandling('findAllByAIPersonaId', async () => {
      const records = await this.client.companyAIPersona.findMany({
        where: { aiPersonaId },
      });

      return records.map(record => this.mapToModel(record));
    });
  }

  async removeAllAssignmentsForPersona(aiPersonaId: string): Promise<number> {
    return this.executeWithErrorHandling('removeAllAssignmentsForPersona', async () => {
      const result = await this.client.companyAIPersona.deleteMany({
        where: { aiPersonaId },
      });

      return result.count;
    });
  }

  async updateAssignmentStatus(
    companyId: string,
    isActive: boolean,
  ): Promise<ICompanyAIPersonaAssignment> {
    return this.executeWithErrorHandling('updateAssignmentStatus', async () => {
      const record = await this.client.companyAIPersona.update({
        where: { companyId },
        data: {
          isActive,
          assignedAt: new Date(), // Update timestamp when status changes
        },
      });

      return this.mapToModel(record);
    });
  }

  private mapToModel(record: Record<string, unknown>): ICompanyAIPersonaAssignment {
    return {
      id: record.id as string,
      companyId: record.companyId as string,
      aiPersonaId: record.aiPersonaId as string,
      isActive: record.isActive as boolean,
      assignedAt: record.assignedAt as Date,
      assignedBy: record.assignedBy as string | null,
    };
  }
}
