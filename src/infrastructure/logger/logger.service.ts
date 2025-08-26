import {
  Inject,
  Injectable,
  LoggerService as NestLoggerService,
  LogLevel,
  Scope,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ILogger } from '@core/interfaces/logger.interface';

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService, ILogger {
  private context?: string;
  private static logLevels: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];
  private readonly apiVersion: string;
  private readonly appVersion: string;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    const env = this.configService.get<string>('env', 'development');
    const logLevel = this.configService.get<string>('logging.level', 'info');

    // Cache version information for performance
    this.apiVersion = this.configService.get<string>('apiVersion', 'v1');
    this.appVersion = this.configService.get<string>('appVersion', '?.?.?');

    // Initialize log levels based on LOG_LEVEL environment variable
    LoggerService.logLevels = this.getLogLevels(env, logLevel);
  }

  setContext(context: string): ILogger {
    this.context = context;

    return this;
  }

  log(message: unknown, context?: string): void {
    if (this.isLevelEnabled('log')) {
      this.printMessage(message, 'log', context || this.context);
    }
  }

  error(message: unknown, stack?: string, context?: string): void {
    if (this.isLevelEnabled('error')) {
      this.printMessage(message, 'error', context || this.context, stack);
    }
  }

  warn(message: unknown, context?: string): void {
    if (this.isLevelEnabled('warn')) {
      this.printMessage(message, 'warn', context || this.context);
    }
  }

  debug(message: unknown, context?: string): void {
    if (this.isLevelEnabled('debug')) {
      this.printMessage(message, 'debug', context || this.context);
    }
  }

  verbose(message: unknown, context?: string): void {
    if (this.isLevelEnabled('verbose')) {
      this.printMessage(message, 'verbose', context || this.context);
    }
  }

  private printMessage(message: unknown, level: LogLevel, context?: string, stack?: string): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = this.formatMessage(message);
    const contextStr = context ? `[${context}]` : '';

    const logEntry = {
      timestamp,
      level,
      message: formattedMessage,
      context: context || 'Application',
      apiVersion: this.apiVersion,
      appVersion: this.appVersion,
    };

    if (stack) {
      Object.assign(logEntry, { stack });
    }

    const versionInfo = `[API:${this.apiVersion}|APP:${this.appVersion}]`;

    if (level === 'error') {
      console.error(
        `${timestamp} ${level.toUpperCase()} ${versionInfo} ${contextStr}:`,
        formattedMessage,
        stack || '',
      );
    } else if (level === 'warn') {
      console.warn(
        `${timestamp} ${level.toUpperCase()} ${versionInfo} ${contextStr}:`,
        formattedMessage,
      );
    } else {
      // For debug, verbose, and log levels in production, we use console.warn
      // to comply with linting rules that only allow console.warn and console.error
      console.warn(
        `${timestamp} ${level.toUpperCase()} ${versionInfo} ${contextStr}:`,
        formattedMessage,
      );
    }
  }

  private formatMessage(message: unknown): string {
    if (typeof message === 'object') {
      return JSON.stringify(message, null, 2);
    }

    return String(message);
  }

  private isLevelEnabled(level: LogLevel): boolean {
    return LoggerService.logLevels.includes(level);
  }

  private getLogLevels(environment: string, logLevel: string): LogLevel[] {
    // Define log level hierarchy
    const levelHierarchy: Record<string, LogLevel[]> = {
      error: ['error'],
      warn: ['error', 'warn'],
      info: ['error', 'warn', 'log'],
      log: ['error', 'warn', 'log'],
      debug: ['error', 'warn', 'log', 'debug'],
      verbose: ['error', 'warn', 'log', 'debug', 'verbose'],
    };

    // Use LOG_LEVEL configuration if provided
    if (levelHierarchy[logLevel.toLowerCase()]) {
      return levelHierarchy[logLevel.toLowerCase()];
    }

    // Fallback to environment-based levels for backward compatibility
    if (environment === 'production') {
      return ['error', 'warn', 'log'];
    }

    return ['error', 'warn', 'log', 'debug', 'verbose'];
  }
}
