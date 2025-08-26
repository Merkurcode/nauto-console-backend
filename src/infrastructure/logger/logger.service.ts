import {
  Inject,
  Injectable,
  LoggerService as NestLoggerService,
  LogLevel,
  Scope,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ILogger } from '@core/interfaces/logger.interface';
import { getCorrelation } from './correlation/context';

type AnyRecord = Record<string, unknown>;
type LogFormat = 'json' | 'human';

// Límites para prevenir memory pressure
const MAX_LOG_BYTES = 16 * 1024; // 16KB por log
const MAX_STACK_BYTES = 8 * 1024; // 8KB por stack
const MAX_DEPTH = 5;
const MAX_ARRAY_ITEMS = 50;

// ===== ANSI Colors =====
const Colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
};

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService, ILogger {
  private context?: string;
  private static logLevels: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];

  private readonly apiVersion: string;
  private readonly appVersion: string;
  private readonly appName: string;
  private readonly environment: string;
  private readonly apmEnabled: boolean;
  private readonly format: LogFormat;

  private static originalConsole?: {
    log: typeof console.log;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
    debug: typeof console.debug;
  };
  private static consoleHijacked = false;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    this.environment = this.config.get<string>('env', 'development');
    const logLevel = this.config.get<string>('logging.level', 'info');

    this.apiVersion = this.config.get<string>('apiVersion', 'v1');
    this.appVersion = this.config.get<string>('appVersion', '?.?.?');
    this.appName = this.config.get<string>('appName', 'app');
    this.apmEnabled = this.config.get<boolean>('logging.apmEnabled', false);
    this.format = this.apmEnabled ? 'json' : this.config.get<LogFormat>('logging.format', 'human');

    LoggerService.logLevels = this.getLogLevels(this.environment, logLevel);
  }

  // ===== Logger API =====
  setContext(context: string): ILogger {
    this.context = context;

    return this;
  }

  log(message: unknown, context?: string): void {
    if (this.isLevelEnabled('log')) this.printMessage(message, 'log', context || this.context);
  }

  error(message: unknown, stack?: string, context?: string): void {
    if (this.isLevelEnabled('error'))
      this.printMessage(message, 'error', context || this.context, stack);
  }

  warn(message: unknown, context?: string): void {
    if (this.isLevelEnabled('warn')) this.printMessage(message, 'warn', context || this.context);
  }

  debug(message: unknown, context?: string): void {
    if (this.isLevelEnabled('debug')) this.printMessage(message, 'debug', context || this.context);
  }

  verbose(message: unknown, context?: string): void {
    if (this.isLevelEnabled('verbose'))
      this.printMessage(message, 'verbose', context || this.context);
  }

  private isLevelEnabled(level: LogLevel): boolean {
    return LoggerService.logLevels.includes(level);
  }

  // ===== Core logging implementation =====
  private printMessage(message: unknown, level: LogLevel, context?: string, stack?: string): void {
    const timestamp = new Date().toISOString();
    const ctx = context || 'Application';

    const { normalizedMessage, normalizedStack, errType, errMsg } = this.normalizeMessageAndStack(
      message,
      stack,
    );

    // Correlation
    const corr = getCorrelation();
    const request_id = corr?.request_id ?? 'no-request-context';
    const trace_id = corr?.trace_id;
    const span_id = corr?.span_id;

    if (this.apmEnabled && this.format === 'json') {
      // === JSON line output (APM-friendly) ===
      const logObj: AnyRecord = {
        timestamp,
        level,
        message: normalizedMessage,
        service: { name: this.appName, version: this.appVersion },
        environment: this.environment,
        apiVersion: this.apiVersion,
        context: ctx,
        request_id,
        trace_id,
        span_id,
      };
      if (normalizedStack) {
        logObj.error = {
          type: errType,
          message: errMsg,
          stack: normalizedStack,
        };
      }
      const line = this.safeStringify(logObj);
      this.routeByLevel(level, line);

      return;
    }

    // === Human-readable mode ===
    const header =
      `${timestamp} ${level.toUpperCase()} ` +
      `[API:${this.apiVersion}|APP:${this.appVersion}] ` +
      `[ENV:${this.environment}] ` +
      `[SRV:${this.appName}] ` +
      `[CTX:${ctx}] ` +
      `[RID:${request_id}${trace_id ? `|T:${trace_id}` : ''}${span_id ? `|S:${span_id}` : ''}]`;

    const line = normalizedStack
      ? `${header}: ${normalizedMessage}\n${normalizedStack}`
      : `${header}: ${normalizedMessage}`;

    // 🎨 aplica color solo en modo humano
    const coloredLine = this.colorize(level, line);

    this.routeByLevel(level, coloredLine);
  }

  private routeByLevel(level: LogLevel, line: string): void {
    switch (level) {
      case 'error':
        console.error(line);
        break;
      case 'warn':
        console.warn(line);
        break;
      case 'debug':
        console.warn(line);
        break;
      case 'verbose':
      case 'log':
      default:
        console.warn(line);
        break;
    }
  }

  // ===== Colors =====
  private colorize(level: LogLevel, text: string): string {
    switch (level) {
      case 'error':
        return `${Colors.red}${text}${Colors.reset}`;
      case 'warn':
        return `${Colors.yellow}${text}${Colors.reset}`;
      case 'debug':
        return `${Colors.cyan}${text}${Colors.reset}`;
      case 'verbose':
        return `${Colors.gray}${text}${Colors.reset}`;
      case 'log':
      default:
        return `${Colors.white}${text}${Colors.reset}`;
    }
  }

  // ===== Helpers =====
  private normalizeMessageAndStack(
    message: unknown,
    stack?: string,
  ): { normalizedMessage: string; normalizedStack?: string; errType?: string; errMsg?: string } {
    if (message instanceof Error) {
      const err = message;
      const meta: AnyRecord = this.errorToPlainObject(err);
      const pretty = this.safeStringify(meta, 2);

      return {
        normalizedMessage: pretty,
        normalizedStack: this.truncate(err.stack || stack || '', MAX_STACK_BYTES),
        errType: err.name,
        errMsg: err.message,
      };
    }
    const normalizedStack = stack ? this.truncate(String(stack), MAX_STACK_BYTES) : undefined;
    if (
      typeof message === 'string' ||
      typeof message === 'number' ||
      typeof message === 'boolean'
    ) {
      return { normalizedMessage: String(message), normalizedStack };
    }
    const pretty = this.safeStringify(message, 2);

    return { normalizedMessage: pretty, normalizedStack };
  }

  private errorToPlainObject(err: Error): AnyRecord {
    const base: AnyRecord = { name: err.name, message: err.message };
    for (const key of Object.keys(err as unknown as AnyRecord)) {
      base[key] = (err as unknown as AnyRecord)[key];
    }

    return base;
  }

  private safeStringify(value: unknown, space = 0): string {
    const seen = new WeakSet<object>();
    const replacer = (_key: string, val: unknown) => {
      if (typeof val === 'bigint') return val.toString();
      if (typeof val === 'object' && val !== null && val !== undefined) {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);

        return this.limitDepth(val, 0);
      }
      if (val instanceof Error) return this.errorToPlainObject(val);

      return val;
    };
    try {
      if (typeof value === 'string' && space === 0) return this.truncate(value);

      const result = JSON.stringify(value, replacer, space);

      return this.truncate(result);
    } catch {
      try {
        return this.truncate(String(value));
      } catch {
        return '[Unserializable]';
      }
    }
  }

  private truncate(s: string, maxBytes = MAX_LOG_BYTES): string {
    if (s.length <= maxBytes) return s;

    return s.slice(0, maxBytes) + `... [truncated ${s.length - maxBytes} chars]`;
  }

  private limitDepth(val: unknown, depth: number): unknown {
    if (depth >= MAX_DEPTH) return '[MaxDepth]';

    if (Array.isArray(val)) {
      const slice = val.slice(0, MAX_ARRAY_ITEMS).map(v => this.limitDepth(v, depth + 1));
      if (val.length > MAX_ARRAY_ITEMS) {
        slice.push(`[+${val.length - MAX_ARRAY_ITEMS} more items]`);
      }

      return slice;
    }

    if (val && typeof val === 'object') {
      const out: Record<string, unknown> = {};
      let count = 0;
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        if (++count > 100) {
          // Límite de propiedades
          out['[overflow]'] = `+${Object.keys(val as object).length - count + 1} more props`;
          break;
        }
        out[k] = this.limitDepth(v, depth + 1);
      }

      return out;
    }

    return val;
  }

  private getLogLevels(environment: string, logLevel: string): LogLevel[] {
    const levelHierarchy: Record<string, LogLevel[]> = {
      error: ['error'],
      warn: ['error', 'warn'],
      info: ['error', 'warn', 'log'],
      log: ['error', 'warn', 'log'],
      debug: ['error', 'warn', 'log', 'debug'],
      verbose: ['error', 'warn', 'log', 'debug', 'verbose'],
    };
    const normalized = (logLevel || '').toLowerCase();
    if (normalized in levelHierarchy) return levelHierarchy[normalized];
    if ((environment || '').toLowerCase() === 'production') return ['error', 'warn', 'log'];

    return ['error', 'warn', 'log', 'debug', 'verbose'];
  }
}
