import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly connectionLimit: number;
  private readonly poolTimeout: number;
  private readonly queryTimeout: number;

  constructor(private configService: ConfigService) {
    // Get connection pool configuration from environment
    const connectionLimit = configService.get<number>('DATABASE_CONNECTION_LIMIT', 10);
    const poolTimeout = configService.get<number>('DATABASE_POOL_TIMEOUT', 10);
    const queryTimeout = configService.get<number>('DATABASE_QUERY_TIMEOUT', 30000);

    // Build database URL with connection pool parameters
    const baseUrl = configService.get<string>('DATABASE_URL');
    const urlWithPool = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`;

    super({
      datasources: {
        db: {
          url: urlWithPool,
        },
      },
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });

    this.connectionLimit = connectionLimit;
    this.poolTimeout = poolTimeout;
    this.queryTimeout = queryTimeout;

    this.logger.log(
      `Database pool configured: ${connectionLimit} connections, ${poolTimeout}s timeout`,
    );
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    // Only for testing purposes
    const models = Reflect.ownKeys(this).filter(key => key[0] !== '_' && key[0] !== '$');

    return Promise.all(
      models.map(modelKey => {
        return this[modelKey as string].deleteMany();
      }),
    );
  }
}
