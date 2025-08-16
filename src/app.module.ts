import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Reflector, APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

// Modules
import { PrismaModule } from '@infrastructure/database/prisma/prisma.module';
import { ThrottlerModule } from '@infrastructure/throttler/throttler.module';
import { I18nModule } from '@infrastructure/i18n/i18n.module';
import { LoggerModule } from '@infrastructure/logger/logger.module';
import { AuthModule } from '@presentation/modules/auth/auth.module';
import { UserModule } from '@presentation/modules/user/user.module';
import { RoleModule } from '@presentation/modules/role/role.module';
import { RootModule } from '@presentation/modules/root/root.module';
import { HealthModule } from '@presentation/modules/health/health.module';
import { CompanyModule } from '@presentation/modules/company/company.module';
import { AIAssistantModule } from '@presentation/modules/ai-assistant/ai-assistant.module';
import { CompanySchedulesModule } from '@presentation/modules/company-schedules/company-schedules.module';
import { BotModule } from '@presentation/modules/bot/bot.module';
import { UserActivityLogModule } from '@presentation/modules/user-activity-log/user-activity-log.module';
import { AIPersonaModule } from '@presentation/modules/ai-persona/ai-persona.module';
import { CoreModule } from '@core/core.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
// import { ValidatorsModule } from '@shared/validators/validators.module'; // Removed - validation moved to domain services

// Global providers
import { LoggingInterceptor } from '@presentation/interceptors/logging.interceptor';
import { TransformInterceptor } from '@presentation/interceptors/transform.interceptor';
import { RequestCacheInterceptor } from '@infrastructure/caching/request-cache.interceptor';
import { AllExceptionsFilter } from '@presentation/filters/all-exceptions.filter';
import { DomainExceptionFilter } from '@presentation/filters/domain-exception.filter';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { ThrottlerGuard } from '@presentation/guards/throttler.guard';
import { UserBanService } from '@core/services/user-ban.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { SessionService } from '@core/services/session.service';
import { BotSessionValidationService } from '@core/services/bot-session-validation.service';
import { TenantResolverService } from '@core/services/tenant-resolver.service';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE, THROTTLER_SERVICE } from '@shared/constants/tokens';

// Config
import configuration from '@infrastructure/config/configuration';
import { BotOptimizationGuard } from '@presentation/guards/bot-optimization.guard';
import { BotRestrictionsGuard } from '@presentation/guards/bot-restrictions.guard';
import { ThrottlerService } from '@infrastructure/services/throttler.service';

@Module({
  imports: [
    // Global Config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
      load: [configuration],
    }),

    // Logging
    LoggerModule,

    // Database
    PrismaModule,

    // Rate Limiting
    ThrottlerModule,

    // Internationalization
    I18nModule,

    // CQRS
    CqrsModule,

    // Scheduling (for automatic cleanup)
    ScheduleModule.forRoot(),

    // JWT Module (Global)
    JwtModule.registerAsync({
      global: true, // Make JwtService available globally
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('jwt.secret'),
        signOptions: {
          expiresIn: configService.get('jwt.accessExpiration', '15m'),
          algorithm: configService.get('jwt.algorithm', 'HS512'),
        },
      }),
    }),

    // Feature Modules (AuthModule FIRST for strategy registration)
    AuthModule,

    // Core Domain and Infrastructure
    CoreModule,
    InfrastructureModule,

    // Other Feature Modules
    UserModule,
    RoleModule,
    RootModule,
    HealthModule,
    CompanyModule,
    AIAssistantModule,
    CompanySchedulesModule,
    BotModule,
    UserActivityLogModule,
    AIPersonaModule,
  ],
  controllers: [],
  providers: [
    // Global interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestCacheInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },

    // Global filters (order matters: more specific first)
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_FILTER,
      useClass: DomainExceptionFilter,
    },

    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector, logger: ILogger) =>
        new BotOptimizationGuard(reflector, logger),
      inject: [Reflector, LOGGER_SERVICE],
    },

    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector, logger: ILogger) =>
        new BotRestrictionsGuard(reflector, logger),
      inject: [Reflector, LOGGER_SERVICE],
    },

    // Throttler Guard (executes FIRST for rate limiting - CRITICAL for DDoS protection)
    {
      provide: APP_GUARD,
      useFactory: (
        reflector: Reflector,
        throttlerService: ThrottlerService,
        configService: ConfigService,
      ) => new ThrottlerGuard(reflector, throttlerService, configService),
      inject: [Reflector, THROTTLER_SERVICE, ConfigService],
    },

    // JWT Auth Guard (executes SECOND for JWT validation with all integrated checks)
    {
      provide: APP_GUARD,
      useFactory: (
        reflector: Reflector,
        jwtService: JwtService,
        userBanService: UserBanService,
        sessionService: SessionService,
        botSessionValidationService: BotSessionValidationService,
        tenantResolverService: TenantResolverService,
        userAuthorizationService: UserAuthorizationService,
        logger: ILogger,
      ) =>
        new JwtAuthGuard(
          reflector,
          jwtService,
          userBanService,
          sessionService,
          botSessionValidationService,
          tenantResolverService,
          userAuthorizationService,
          logger,
        ),
      inject: [
        Reflector,
        JwtService,
        UserBanService,
        SessionService,
        BotSessionValidationService,
        TenantResolverService,
        UserAuthorizationService,
        LOGGER_SERVICE,
      ],
    },
  ],
})
export class AppModule {}
