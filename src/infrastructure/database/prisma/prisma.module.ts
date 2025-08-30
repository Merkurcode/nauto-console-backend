import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { TransactionService } from './transaction.service';
import { TransactionContextService } from './transaction-context.service';
import { TransactionWithContextService } from './transaction-with-context.service';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PrismaService,
      useFactory: (configService: ConfigService, logger: ILogger) =>
        new PrismaService(configService, logger),
      inject: [ConfigService, LOGGER_SERVICE],
    },
    TransactionService,
    TransactionContextService,
    TransactionWithContextService,
  ],
  exports: [
    PrismaService,
    TransactionService,
    TransactionContextService,
    TransactionWithContextService,
  ],
})
export class PrismaModule {}
