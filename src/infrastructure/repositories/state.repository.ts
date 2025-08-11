import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { IStateRepository } from '@core/repositories/state.repository.interface';
import { State } from '@core/entities/state.entity';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

@Injectable()
export class StateRepository implements IStateRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionContext: TransactionContextService,
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
  ) {
    this.logger.setContext(StateRepository.name);
  }

  private get client() {
    return this.transactionContext.getTransactionClient() || this.prisma;
  }

  async findById(id: string): Promise<State | null> {
    try {
      const state = await this.client.state.findUnique({
        where: { id },
      });

      if (!state) {
        return null;
      }

      return State.fromPersistence(state);
    } catch (error) {
      this.logger.error({
        message: 'Error finding state by ID',
        stateId: id,
        error: error.message,
      });
      throw error;
    }
  }

  async findByName(name: string): Promise<State | null> {
    try {
      const state = await this.client.state.findFirst({
        where: { name },
      });

      if (!state) {
        return null;
      }

      return State.fromPersistence(state);
    } catch (error) {
      this.logger.error({
        message: 'Error finding state by name',
        stateName: name,
        error: error.message,
      });
      throw error;
    }
  }

  async findByNameAndCountry(name: string, countryId: string): Promise<State | null> {
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
      this.logger.error({
        message: 'Error finding state by name and country',
        stateName: name,
        countryId,
        error: error.message,
      });
      throw error;
    }
  }

  async findByCountryId(countryId: string): Promise<State[]> {
    try {
      const states = await this.client.state.findMany({
        where: { countryId },
        orderBy: { name: 'asc' },
      });

      return states.map(state => State.fromPersistence(state));
    } catch (error) {
      this.logger.error({
        message: 'Error finding states by country ID',
        countryId,
        error: error.message,
      });
      throw error;
    }
  }

  async findAll(): Promise<State[]> {
    try {
      const states = await this.client.state.findMany({
        orderBy: { name: 'asc' },
      });

      return states.map(state => State.fromPersistence(state));
    } catch (error) {
      this.logger.error({
        message: 'Error finding all states',
        error: error.message,
      });
      throw error;
    }
  }

  async create(state: State): Promise<State> {
    try {
      const createdState = await this.client.state.create({
        data: {
          id: state.id.getValue(),
          name: state.name,
          countryId: state.countryId.getValue(),
        },
      });

      this.logger.log({
        message: 'State created successfully',
        stateId: createdState.id,
        stateName: createdState.name,
        countryId: createdState.countryId,
      });

      return State.fromPersistence(createdState);
    } catch (error) {
      this.logger.error({
        message: 'Error creating state',
        stateName: state.name,
        countryId: state.countryId.getValue(),
        error: error.message,
      });
      throw error;
    }
  }

  async update(state: State): Promise<State> {
    try {
      const updatedState = await this.client.state.update({
        where: { id: state.id.getValue() },
        data: {
          name: state.name,
          countryId: state.countryId.getValue(),
          updatedAt: state.updatedAt,
        },
      });

      this.logger.log({
        message: 'State updated successfully',
        stateId: updatedState.id,
        stateName: updatedState.name,
      });

      return State.fromPersistence(updatedState);
    } catch (error) {
      this.logger.error({
        message: 'Error updating state',
        stateId: state.id.getValue(),
        error: error.message,
      });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.client.state.delete({
        where: { id },
      });

      this.logger.log({
        message: 'State deleted successfully',
        stateId: id,
      });
    } catch (error) {
      this.logger.error({
        message: 'Error deleting state',
        stateId: id,
        error: error.message,
      });
      throw error;
    }
  }
}
