import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly configService: ConfigService,
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
  ) {
    // Get connection pool configuration from environment (optimized for high concurrency)
    const connectionLimit = configService.get<number>('database.connectionLimit', 50);
    const poolTimeout = configService.get<number>('database.poolTimeout', 30);

    // Build database URL with connection pool parameters
    const baseUrl = configService.get<string>('database.url');
    if (!baseUrl) {
      throw new Error('DATABASE_URL is not configured. Please check your environment variables.');
    }
    const urlWithPool = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`;

    // Configure Prisma logging based on PRISMA_LOGS_ENABLED environment variable
    const prismaLogsEnabled = configService.get<boolean>('logging.prismaLogsEnabled', false);
    const logConfig: Prisma.LogLevel[] = prismaLogsEnabled
      ? ['query', 'info', 'warn', 'error']
      : ['error'];

    super({
      datasources: {
        db: {
          url: urlWithPool,
        },
      },
      log: logConfig,
    });

    this.logger.log(
      `Database pool configured: ${connectionLimit} connections, ${poolTimeout}s timeout`,
    );
    this.logger.log(`Prisma database logs: ${prismaLogsEnabled ? 'enabled' : 'disabled'}`);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /*async cleanDatabase() {
    if (this.configService.get<string>('env') === 'production') {
      return;
    }

    // Only for testing purposes
    const models = Reflect.ownKeys(this).filter(key => key[0] !== '_' && key[0] !== '$');

    return Promise.all(
      models.map(modelKey => {
        return this[modelKey as string].deleteMany();
      }),
    );
  }*/
}
