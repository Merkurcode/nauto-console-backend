import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT, LOGGER_SERVICE } from '@shared/constants/tokens';
import { RedisConnectionFactory, REDIS_CONNECTION_FACTORY } from './redis-connection-factory';
import { ILogger } from '@core/interfaces/logger.interface';

@Module({
  providers: [
    // Factory para crear conexiones dedicadas
    {
      provide: REDIS_CONNECTION_FACTORY,
      useFactory: (configService: ConfigService, logger: ILogger) => {
        return new RedisConnectionFactory(configService, logger);
      },
      inject: [ConfigService, LOGGER_SERVICE],
    },

    // Conexión principal para servicios de storage/concurrency
    // IMPORTANTE: Esta conexión NO debe ser compartida con BullMQ
    {
      provide: REDIS_CLIENT,
      useFactory: (factory: RedisConnectionFactory) => {
        return factory.createConnection('storage-concurrency', {
          // Configuración específica para storage operations
          db: 0, // Database dedicada para storage
        });
      },
      inject: [REDIS_CONNECTION_FACTORY],
    },
  ],
  exports: [REDIS_CLIENT, REDIS_CONNECTION_FACTORY],
})
export class RedisModule {}
