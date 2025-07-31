import { Country } from '@core/entities/country.entity';

export interface ICountryRepository {
  findById(id: string): Promise<Country | null>;
  findByName(name: string): Promise<Country | null>;
  findAll(): Promise<Country[]>;
  create(country: Country): Promise<Country>;
  update(country: Country): Promise<Country>;
  delete(id: string): Promise<void>;
}
