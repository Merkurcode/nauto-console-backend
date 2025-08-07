import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

/**
 * Optimized Prisma Service for 1M+ concurrent users
 * 
 * Key features:
 * - Connection pooling with read/write separation
 * - Query performance monitoring
 * - Health checks and failover
 * - Connection load balancing
 * - Graceful degradation
 */
@Injectable()
export class OptimizedPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readOnlyClients: PrismaClient[] = [];
  private writeClients: PrismaClient[] = [];
  private currentReadIndex = 0;
  private currentWriteIndex = 0;
  
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private connectionStats = {
    totalQueries: 0,
    errorCount: 0,
    avgQueryTime: 0,
    connections: {
      read: 0,
      write: 0,
      healthy: true,
    },
  };

  // Configuration for 1M users
  private readonly READ_POOL_SIZE: number;
  private readonly WRITE_POOL_SIZE: number;
  private readonly CONNECTION_LIMIT: number;
  private readonly QUERY_TIMEOUT: number;
  private readonly POOL_TIMEOUT: number;

  constructor(
    private configService: ConfigService,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    // Load configuration optimized for 1M users
    const connectionLimit = configService.get<number>('DATABASE_CONNECTION_LIMIT', 100); // Increased from 10
    const poolTimeout = configService.get<number>('DATABASE_POOL_TIMEOUT', 10);
    const queryTimeout = configService.get<number>('DATABASE_QUERY_TIMEOUT', 30000);
    
    // Pool sizes for read/write separation
    const readPoolSize = configService.get<number>('DATABASE_READ_POOL_SIZE', 60); // 60% for reads
    const writePoolSize = configService.get<number>('DATABASE_WRITE_POOL_SIZE', 40); // 40% for writes

    // Build optimized database URL
    const baseUrl = configService.get<string>('DATABASE_URL');
    const readUrl = configService.get<string>('DATABASE_READ_URL') || baseUrl; // Read replica if available
    
    const urlWithPool = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}&connect_timeout=5&socket_timeout=30`;

    super({
      datasources: {
        db: { url: urlWithPool },
      },
      
      // Optimized logging for production
      log: configService.get<string>('NODE_ENV') === 'production' 
        ? [
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ]
        : [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'info' },
            { emit: 'event', level: 'warn' },
          ],
    });

    this.READ_POOL_SIZE = readPoolSize;
    this.WRITE_POOL_SIZE = writePoolSize;
    this.CONNECTION_LIMIT = connectionLimit;
    this.QUERY_TIMEOUT = queryTimeout;
    this.POOL_TIMEOUT = poolTimeout;

    this.logger.setContext(OptimizedPrismaService.name);
    this.setupQueryLogging();
    this.initializeConnectionPools(baseUrl, readUrl);
  }

  async onModuleInit() {
    try {
      // Connect main instance
      await this.$connect();
      
      // Connect all pool instances
      await this.connectAllPools();
      
      // Start health monitoring
      this.startHealthChecks();
      
      this.logger.log({
        message: 'Optimized database connections initialized',
        readPool: this.readOnlyClients.length,
        writePool: this.writeClients.length,
        totalConnections: this.readOnlyClients.length + this.writeClients.length + 1,
        connectionLimit: this.CONNECTION_LIMIT,
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to initialize database connections',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      this.stopHealthChecks();
      await this.disconnectAllPools();
      await this.$disconnect();
      
      this.logger.log({
        message: 'All database connections closed gracefully',
        finalStats: this.connectionStats,
      });
    } catch (error) {
      this.logger.error({
        message: 'Error closing database connections',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get a read-optimized client (load balanced)
   */
  getReadClient(): PrismaClient {
    if (this.readOnlyClients.length === 0) {
      return this; // Fallback to main client
    }
    
    const client = this.readOnlyClients[this.currentReadIndex];
    this.currentReadIndex = (this.currentReadIndex + 1) % this.readOnlyClients.length;
    return client;
  }

  /**
   * Get a write-optimized client (load balanced)
   */
  getWriteClient(): PrismaClient {
    if (this.writeClients.length === 0) {
      return this; // Fallback to main client
    }
    
    const client = this.writeClients[this.currentWriteIndex];
    this.currentWriteIndex = (this.currentWriteIndex + 1) % this.writeClients.length;
    return client;
  }

  /**
   * Execute a read query with automatic client selection
   */
  async executeRead<T>(operation: (client: PrismaClient) => Promise<T>): Promise<T> {
    const client = this.getReadClient();
    const startTime = Date.now();
    
    try {
      const result = await operation(client);
      this.updateQueryStats(Date.now() - startTime, false);
      return result;
    } catch (error) {
      this.updateQueryStats(Date.now() - startTime, true);
      throw error;
    }
  }

  /**
   * Execute a write query with automatic client selection
   */
  async executeWrite<T>(operation: (client: PrismaClient) => Promise<T>): Promise<T> {
    const client = this.getWriteClient();
    const startTime = Date.now();
    
    try {
      const result = await operation(client);
      this.updateQueryStats(Date.now() - startTime, false);
      return result;
    } catch (error) {
      this.updateQueryStats(Date.now() - startTime, true);
      throw error;
    }
  }

  /**
   * Execute operation in transaction with write client
   */
  async executeInTransaction<T>(
    operation: (client: PrismaClient) => Promise<T>,
  ): Promise<T> {
    const client = this.getWriteClient();
    return client.$transaction(operation, {
      timeout: this.QUERY_TIMEOUT,
    });
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): typeof this.connectionStats {
    return { ...this.connectionStats };
  }

  /**
   * Initialize connection pools
   */
  private initializeConnectionPools(writeUrl: string, readUrl: string): void {
    const createClientConfig = (url: string, poolSize: number) => ({
      datasources: { db: { url: `${url}${url.includes('?') ? '&' : '?'}connection_limit=${Math.ceil(this.CONNECTION_LIMIT / poolSize)}&pool_timeout=${this.POOL_TIMEOUT}` } },
      log: this.configService.get<string>('NODE_ENV') === 'production' ? [{ emit: 'event', level: 'error' }] : [],
    });

    // Create read-only clients
    for (let i = 0; i < this.READ_POOL_SIZE; i++) {
      const client = new PrismaClient(createClientConfig(readUrl, this.READ_POOL_SIZE));
      this.readOnlyClients.push(client);
    }

    // Create write clients
    for (let i = 0; i < this.WRITE_POOL_SIZE; i++) {
      const client = new PrismaClient(createClientConfig(writeUrl, this.WRITE_POOL_SIZE));
      this.writeClients.push(client);
    }
  }

  /**
   * Connect all pool instances
   */
  private async connectAllPools(): Promise<void> {
    const connectPromises: Promise<void>[] = [];
    
    // Connect read clients
    for (const client of this.readOnlyClients) {
      connectPromises.push(client.$connect());
    }
    
    // Connect write clients
    for (const client of this.writeClients) {
      connectPromises.push(client.$connect());
    }
    
    await Promise.all(connectPromises);
    
    this.connectionStats.connections.read = this.readOnlyClients.length;
    this.connectionStats.connections.write = this.writeClients.length;
  }

  /**
   * Disconnect all pool instances
   */
  private async disconnectAllPools(): Promise<void> {
    const disconnectPromises: Promise<void>[] = [];
    
    // Disconnect read clients
    for (const client of this.readOnlyClients) {
      disconnectPromises.push(client.$disconnect());
    }
    
    // Disconnect write clients
    for (const client of this.writeClients) {
      disconnectPromises.push(client.$disconnect());
    }
    
    await Promise.all(disconnectPromises);
  }

  /**
   * Setup query logging and monitoring
   */
  private setupQueryLogging(): void {
    this.$on('query', (e) => {
      if (this.configService.get<string>('NODE_ENV') === 'development') {
        this.logger.debug({
          query: e.query,
          params: e.params,
          duration: `${e.duration}ms`,
        });
      }
    });

    this.$on('error', (e) => {
      this.logger.error({
        message: 'Database error',
        error: e.message,
        target: e.target,
      });
    });
  }

  /**
   * Update query statistics
   */
  private updateQueryStats(duration: number, isError: boolean): void {
    this.connectionStats.totalQueries++;
    
    if (isError) {
      this.connectionStats.errorCount++;
    }
    
    // Update average query time (exponential moving average)
    const alpha = 0.1; // Smoothing factor
    this.connectionStats.avgQueryTime = 
      (alpha * duration) + ((1 - alpha) * this.connectionStats.avgQueryTime);
  }

  /**
   * Start health checks for all connections
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        // Test main connection
        await this.rawUnsafe('SELECT 1');
        
        // Test read connections (sample a few)
        const readSample = Math.min(3, this.readOnlyClients.length);
        for (let i = 0; i < readSample; i++) {
          await this.readOnlyClients[i].$queryRaw`SELECT 1`;
        }
        
        // Test write connections (sample a few)
        const writeSample = Math.min(3, this.writeClients.length);
        for (let i = 0; i < writeSample; i++) {
          await this.writeClients[i].$queryRaw`SELECT 1`;
        }
        
        if (!this.connectionStats.connections.healthy) {
          this.connectionStats.connections.healthy = true;
          this.logger.log('Database health check passed - connections restored');
        }
      } catch (error) {
        if (this.connectionStats.connections.healthy) {
          this.connectionStats.connections.healthy = false;
          this.logger.error({
            message: 'Database health check failed',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop health checks
   */
  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Clean database (only for testing)
   */
  async cleanDatabase() {
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      throw new Error('Database cleaning is not allowed in production');
    }

    const models = Reflect.ownKeys(this).filter(key => 
      typeof key === 'string' && 
      key[0] !== '_' && 
      key[0] !== '$' &&
      typeof this[key as keyof this] === 'object'
    );

    return Promise.all(
      models.map(modelKey => {
        const model = this[modelKey as keyof this] as any;
        return model?.deleteMany?.();
      }).filter(Boolean),
    );
  }
}