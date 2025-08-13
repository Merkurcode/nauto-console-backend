import { State } from '@core/entities/state.entity';

/**
 * State repository interface
 *
 * Implementations:
 * - {@link State} - Production Prisma/PostgreSQL implementation
 */
export interface IStateRepository {
  findById(id: string): Promise<State | null>;
  findByName(name: string): Promise<State | null>;
  findByNameAndCountry(name: string, countryId: string): Promise<State | null>;
  findByCountryId(countryId: string): Promise<State[]>;
  findAll(): Promise<State[]>;
  create(state: State): Promise<State>;
  update(state: State): Promise<State>;
  delete(id: string): Promise<void>;
}
