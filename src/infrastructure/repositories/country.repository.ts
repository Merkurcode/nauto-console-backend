import { Injectable, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { ICountryRepository } from '@core/repositories/country.repository.interface';
import { Country } from '@core/entities/country.entity';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { BaseRepository } from './base.repository';

@Injectable()
export class CountryRepository extends BaseRepository<Country> implements ICountryRepository {
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

  async findById(id: string): Promise<Country | null> {
    return this.executeWithErrorHandling('findById', async () => {
      try {
        const country = await this.client.country.findUnique({
          where: { id },
        });

        if (!country) {
          return null;
        }

        return Country.fromPersistence(country);
      } catch (error) {
        throw error;
      }
    });
  }

  async findByName(name: string): Promise<Country | null> {
    return this.executeWithErrorHandling('findByName', async () => {
      try {
        const country = await this.client.country.findUnique({
          where: { name },
        });

        if (!country) {
          return null;
        }

        return Country.fromPersistence(country);
      } catch (error) {
        throw error;
      }
    });
  }

  async findAll(): Promise<Country[]> {
    return this.executeWithErrorHandling('findAll', async () => {
      try {
        const countries = await this.client.country.findMany({
          orderBy: { name: 'asc' },
        });

        return countries.map(country => Country.fromPersistence(country));
      } catch (error) {
        throw error;
      }
    });
  }

  async create(country: Country): Promise<Country> {
    return this.executeWithErrorHandling('create', async () => {
      try {
        const createdCountry = await this.client.country.create({
          data: {
            id: country.id.getValue(),
            name: country.name,
            phoneCode: country.phoneCode,
            langCode: country.langCode,
            imageUrl: country.imageUrl,
          },
        });

        return Country.fromPersistence(createdCountry);
      } catch (error) {
        throw error;
      }
    });
  }

  async update(country: Country): Promise<Country> {
    return this.executeWithErrorHandling('update', async () => {
      try {
        const updatedCountry = await this.client.country.update({
          where: { id: country.id.getValue() },
          data: {
            name: country.name,
            phoneCode: country.phoneCode,
            langCode: country.langCode,
            imageUrl: country.imageUrl,
            updatedAt: country.updatedAt,
          },
        });

        return Country.fromPersistence(updatedCountry);
      } catch (error) {
        throw error;
      }
    });
  }

  async delete(id: string): Promise<void> {
    return this.executeWithErrorHandling('delete', async () => {
      try {
        await this.client.country.delete({
          where: { id },
        });
      } catch (error) {
        throw error;
      }
    });
  }
}
