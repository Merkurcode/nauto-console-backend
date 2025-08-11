import { Injectable, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { IStateRepository } from '@core/repositories/state.repository.interface';
import { State } from '@core/entities/state.entity';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { BaseRepository } from './base.repository';

@Injectable()
export class StateRepository extends BaseRepository<State> implements IStateRepository {
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

  async findById(id: string): Promise<State | null> {
    return this.executeWithErrorHandling('findById', async () => {
      try {
        const state = await this.client.state.findUnique({
          where: { id },
        });

        if (!state) {
          return null;
        }

        return State.fromPersistence(state);
      } catch (error) {
        throw error;
      }
    });
  }

  async findByName(name: string): Promise<State | null> {
    return this.executeWithErrorHandling('findByName', async () => {
      try {
        const state = await this.client.state.findFirst({
          where: { name },
        });

        if (!state) {
          return null;
        }

        return State.fromPersistence(state);
      } catch (error) {
        throw error;
      }
    });
  }

  async findByNameAndCountry(name: string, countryId: string): Promise<State | null> {
    return this.executeWithErrorHandling('findByNameAndCountry', async () => {
      try {
        const state = await this.client.state.findFirst({
          where: {
            name,
            countryId,
          },
        });

        if (!state) {
          return null;
        }

        return State.fromPersistence(state);
      } catch (error) {
        throw error;
      }
    });
  }

  async findByCountryId(countryId: string): Promise<State[]> {
    return this.executeWithErrorHandling('findByCountryId', async () => {
      try {
        const states = await this.client.state.findMany({
          where: { countryId },
          orderBy: { name: 'asc' },
        });

        return states.map(state => State.fromPersistence(state));
      } catch (error) {
        throw error;
      }
    });
  }

  async findAll(): Promise<State[]> {
    return this.executeWithErrorHandling('findAll', async () => {
      try {
        const states = await this.client.state.findMany({
          orderBy: { name: 'asc' },
        });

        return states.map(state => State.fromPersistence(state));
      } catch (error) {
        throw error;
      }
    });
  }

  async create(state: State): Promise<State> {
    return this.executeWithErrorHandling('create', async () => {
      try {
        const createdState = await this.client.state.create({
          data: {
            id: state.id.getValue(),
            name: state.name,
            countryId: state.countryId.getValue(),
          },
        });

        return State.fromPersistence(createdState);
      } catch (error) {
        throw error;
      }
    });
  }

  async update(state: State): Promise<State> {
    return this.executeWithErrorHandling('update', async () => {
      try {
        const updatedState = await this.client.state.update({
          where: { id: state.id.getValue() },
          data: {
            name: state.name,
            countryId: state.countryId.getValue(),
            updatedAt: state.updatedAt,
          },
        });

        return State.fromPersistence(updatedState);
      } catch (error) {
        throw error;
      }
    });
  }

  async delete(id: string): Promise<void> {
    return this.executeWithErrorHandling('delete', async () => {
      try {
        await this.client.state.delete({
          where: { id },
        });
      } catch (error) {
        throw error;
      }
    });
  }
}
