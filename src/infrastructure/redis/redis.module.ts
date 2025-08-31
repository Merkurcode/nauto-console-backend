import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from '@shared/constants/tokens';
import { RedisConnectionFactory, REDIS_CONNECTION_FACTORY } from './redis-connection-factory';

@Module({
  providers: [
    // Factory para crear conexiones dedicadas
    {
      provide: REDIS_CONNECTION_FACTORY,
      useFactory: (configService: ConfigService) => {
        return new RedisConnectionFactory(configService);
      },
      inject: [ConfigService],
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
