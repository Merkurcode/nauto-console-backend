import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { ICountryRepository } from '@core/repositories/country.repository.interface';
import { Country } from '@core/entities/country.entity';
import { LoggerService } from '@infrastructure/logger/logger.service';

@Injectable()
export class CountryRepository implements ICountryRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(CountryRepository.name);
  }

  async findById(id: string): Promise<Country | null> {
    try {
      const country = await this.prisma.country.findUnique({
        where: { id },
      });

      if (!country) {
        return null;
      }

      return Country.fromPersistence(country);
    } catch (error) {
      this.logger.error({
        message: 'Error finding country by ID',
        countryId: id,
        error: error.message,
      });
      throw error;
    }
  }

  async findByName(name: string): Promise<Country | null> {
    try {
      const country = await this.prisma.country.findUnique({
        where: { name },
      });

      if (!country) {
        return null;
      }

      return Country.fromPersistence(country);
    } catch (error) {
      this.logger.error({
        message: 'Error finding country by name',
        countryName: name,
        error: error.message,
      });
      throw error;
    }
  }

  async findAll(): Promise<Country[]> {
    try {
      const countries = await this.prisma.country.findMany({
        orderBy: { name: 'asc' },
      });

      return countries.map(country => Country.fromPersistence(country));
    } catch (error) {
      this.logger.error({
        message: 'Error finding all countries',
        error: error.message,
      });
      throw error;
    }
  }

  async create(country: Country): Promise<Country> {
    try {
      const createdCountry = await this.prisma.country.create({
        data: {
          id: country.id.getValue(),
          name: country.name,
          phoneCode: country.phoneCode,
          langCode: country.langCode,
          imageUrl: country.imageUrl,
        },
      });

      this.logger.log({
        message: 'Country created successfully',
        countryId: createdCountry.id,
        countryName: createdCountry.name,
      });

      return Country.fromPersistence(createdCountry);
    } catch (error) {
      this.logger.error({
        message: 'Error creating country',
        countryName: country.name,
        error: error.message,
      });
      throw error;
    }
  }

  async update(country: Country): Promise<Country> {
    try {
      const updatedCountry = await this.prisma.country.update({
        where: { id: country.id.getValue() },
        data: {
          name: country.name,
          phoneCode: country.phoneCode,
          langCode: country.langCode,
          imageUrl: country.imageUrl,
          updatedAt: country.updatedAt,
        },
      });

      this.logger.log({
        message: 'Country updated successfully',
        countryId: updatedCountry.id,
        countryName: updatedCountry.name,
      });

      return Country.fromPersistence(updatedCountry);
    } catch (error) {
      this.logger.error({
        message: 'Error updating country',
        countryId: country.id.getValue(),
        error: error.message,
      });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.country.delete({
        where: { id },
      });

      this.logger.log({
        message: 'Country deleted successfully',
        countryId: id,
      });
    } catch (error) {
      this.logger.error({
        message: 'Error deleting country',
        countryId: id,
        error: error.message,
      });
      throw error;
    }
  }
}
