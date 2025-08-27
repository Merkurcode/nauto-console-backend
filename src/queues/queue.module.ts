import {
  Module,
  DynamicModule,
  Type,
  Injectable,
  OnApplicationBootstrap,
  Scope,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { CqrsModule } from '@nestjs/cqrs';
import { ModuleRef } from '@nestjs/core';
import { CoreModule } from '@core/core.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';

import { HealthService } from './health/health-checker.service';
import { QueueHealthController } from './controllers/queue-health.controller';
import { QueueEventsController } from './controllers/queue-events.controller';
import { getQueueConfig } from './config/queue.config';
import { IEventHandler, IRedisConfig, IQueueDefinition } from './types';
import { HandlerRegistry } from './registry/event-registry';
import { setConfigService } from './validation/event-validation';
import { EVENT_HANDLERS, LOGGER_SERVICE } from '@shared/constants/tokens';
import { SmsService } from '@core/services/sms.service';

@Injectable()
class QueueRegistrationService implements OnApplicationBootstrap {
  constructor(
    private readonly healthService: HealthService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onApplicationBootstrap() {
    const queueNames = (this as any).queueNames || [];
    let registeredCount = 0;

    for (const queueName of queueNames) {
      try {
        const queue = this.moduleRef.get(`BullQueue_${queueName}`, { strict: false });
        if (queue && typeof this.healthService.registerQueue === 'function') {
          this.healthService.registerQueue(queueName, queue);
          registeredCount++;
        }
      } catch (error) {
        console.warn(
          `Failed to register queue ${queueName}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    if (registeredCount > 0) {
      console.warn(
        `✅ Successfully registered ${registeredCount}/${queueNames.length} queues in HealthService`,
      );
    } else {
      console.warn('⚠️ No queues were registered in HealthService');
    }
  }
}

export interface IQueueModuleOptions {
  processType: 'api' | 'worker' | 'both';
  eventHandlers?: Type<IEventHandler>[] | 'auto-detect';
  redisConfig?: IRedisConfig;
  queues?: IQueueDefinition[];
  includeConfigModule?: boolean;
}

@Module({})
export class QueueModule {
  static forApiProcess(options?: Partial<IQueueModuleOptions>): DynamicModule {
    return this.createModule({ processType: 'api', ...options });
  }

  static forWorkerProcess(
    eventHandlersOrOptions?: Type<IEventHandler>[] | Partial<IQueueModuleOptions>,
    optionsParam?: Partial<IQueueModuleOptions>,
  ): DynamicModule {
    if (Array.isArray(eventHandlersOrOptions)) {
      return this.createModule({
        processType: 'worker',
        eventHandlers: eventHandlersOrOptions,
        ...optionsParam,
      });
    }

    return this.createModule({
      processType: 'worker',
      eventHandlers: 'auto-detect',
      ...eventHandlersOrOptions,
    });
  }

  static forBothProcesses(
    eventHandlersOrOptions?: Type<IEventHandler>[] | Partial<IQueueModuleOptions>,
    optionsParam?: Partial<IQueueModuleOptions>,
  ): DynamicModule {
    if (Array.isArray(eventHandlersOrOptions)) {
      return this.createModule({
        processType: 'both',
        eventHandlers: eventHandlersOrOptions,
        ...optionsParam,
      });
    }

    return this.createModule({
      processType: 'both',
      eventHandlers: 'auto-detect',
      ...eventHandlersOrOptions,
    });
  }

  static withQueues(
    processType: 'api' | 'worker' | 'both',
    queues: IQueueDefinition[],
    options?: Partial<Omit<IQueueModuleOptions, 'processType' | 'queues'>>,
  ): DynamicModule {
    return this.createModule({
      processType,
      queues,
      ...options,
    });
  }

  private static createModule(options: IQueueModuleOptions): DynamicModule {
    const imports: DynamicModule['imports'] = [];

    // 1) Config module (optional)
    if (options.includeConfigModule !== false) {
      imports.push(
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
        }),
      );
    }

    // 2) BullMQ connection
    imports.push(
      BullModule.forRootAsync({
        // Después (mejor para procesos mixtos)
        useFactory: async (configService: ConfigService) => {
          const effective = options.processType === 'both' ? 'worker' : options.processType;

          return getQueueConfig(configService, effective);
        },

        inject: [ConfigService],
      }),
    );

    // 3) Register queues dynamically
    const queuesToRegister = options?.queues?.length ? options.queues : [];

    const queuesWithStreams = queuesToRegister.map(queue => {
      const baseQueue: any = { name: queue.name };

      // Only add streams if the queue definition includes them
      if ('streams' in queue && queue.streams) {
        baseQueue.streams = { events: queue.streams };
      } else {
        // Add default streams configuration with fallback values
        baseQueue.streams = {
          events: {
            maxLen: parseInt(process.env.QUEUE_EVENTS_STREAM_MAXLEN || '20000', 10),
            approximate: process.env.QUEUE_EVENTS_STREAM_APPROX !== 'false',
          },
        };
      }

      return baseQueue;
    });

    imports.push(BullModule.registerQueue(...queuesWithStreams));

    // 4) Providers/controllers by role
    const providers: DynamicModule['providers'] = [];
    const exportsArr: DynamicModule['exports'] = [];
    const controllers: DynamicModule['controllers'] = [];

    if (options.processType === 'api' || options.processType === 'both') {
      providers.push(HealthService);
      exportsArr.push(HealthService);
      controllers.push(QueueHealthController, QueueEventsController);

      // Initialize event validation with ConfigService
      providers.push({
        provide: 'EVENT_VALIDATION_INITIALIZER',
        useFactory: (configService: ConfigService) => {
          setConfigService(configService);

          return true;
        },
        inject: [ConfigService],
      });

      // Register event bus adapters dynamically
      if (options.queues && options.queues.length > 0) {
        options.queues.forEach(queue => {
          if (queue.eventBusAdapter) {
            providers.push(queue.eventBusAdapter);
            exportsArr.push(queue.eventBusAdapter);
          }
        });

        // Queue registration service
        providers.push({
          provide: QueueRegistrationService,
          useFactory: (healthService: HealthService, moduleRef: ModuleRef) => {
            const service = new QueueRegistrationService(healthService, moduleRef);
            (service as any).queueNames = queuesToRegister.map(q => q.name);

            return service;
          },
          inject: [HealthService, ModuleRef],
        });
      }
    }

    if (options.processType === 'worker' || options.processType === 'both') {
      imports.push(CqrsModule);

      // Import necessary modules for auto-detected handlers
      imports.push(CoreModule, InfrastructureModule);

      let handlersToUse: Type<IEventHandler>[] = [];
      if (options.eventHandlers === 'auto-detect') {
        handlersToUse = this.getAutoDetectedHandlers();
      } else if (Array.isArray(options.eventHandlers)) {
        handlersToUse = options.eventHandlers;
      }

      // Register processors dynamically
      if (options.queues && options.queues.length > 0) {
        options.queues.forEach(queue => {
          if (queue.processor) {
            providers.push(queue.processor);
          }
        });
      }

      // Add queue-specific SMS service (no repository dependencies)
      providers.push({
        provide: SmsService,
        useFactory: (configService: ConfigService, logger: any) => {
          return new SmsService(configService, logger);
        },
        inject: [ConfigService, LOGGER_SERVICE],
        scope: Scope.DEFAULT,
      });
      exportsArr.push(SmsService);

      // Register handlers globally
      providers.push(...handlersToUse, {
        provide: EVENT_HANDLERS,
        useFactory: (...handlers: unknown[]) => handlers,
        inject: handlersToUse,
        scope: Scope.DEFAULT,
      });
    }

    return {
      module: QueueModule,
      imports,
      providers,
      controllers,
      exports: exportsArr,
      global: true,
    };
  }

  private static getAutoDetectedHandlers(): Type<IEventHandler>[] {
    const handlers = HandlerRegistry.getAllHandlerConstructors();
    if (!handlers.length) {
      console.warn(
        '⚠️  No handlers found with @MQSerializableEventHandler. ' +
          'Import your handlers before forWorkerProcess() or pass them manually.',
      );
    } else {
      console.warn(
        `🔍 Auto-detected ${handlers.length} handlers:\n${handlers.map(h => h.name).join('\n')}`,
      );
    }

    return handlers as Type<IEventHandler>[];
  }
}
