import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HealthService } from '../health/health-checker.service';

/**
 * Factory function to create queue-specific health guards
 */
export function createQueueHealthGuard(queueName: string) {
  @Injectable()
  class DynamicQueueHealthGuard implements CanActivate {
    constructor(public readonly health: HealthService) {}

    canActivate(context: ExecutionContext): boolean {
      if (!this.health) {
        throw new HttpException(
          {
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            message: 'Health service not available',
            timestamp: new Date().toISOString(),
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      // Add queue name to request so @QueueName() decorator can access it
      const request = context.switchToHttp().getRequest();
      request.queueName = queueName;

      const health = this.health.getSummary(queueName);

      if (!health || !('stale' in health)) {
        throw new HttpException(
          {
            statusCode: HttpStatus.NOT_FOUND,
            message: 'Requested resource not found',
            error: 'Not Found',
            timestamp: new Date().toISOString(),
          },
          HttpStatus.NOT_FOUND,
        );
      }

      if (health.accepting && !health.stale) {
        return true;
      }

      const statusCode = health.stale
        ? HttpStatus.SERVICE_UNAVAILABLE
        : HttpStatus.TOO_MANY_REQUESTS;

      throw new HttpException(
        {
          statusCode,
          message: 'Service temporarily unavailable due to high load. Please retry later.',
          error: health.stale ? 'Service Unavailable' : 'Too Many Requests',
          timestamp: new Date().toISOString(),
          retryAfter: health.stale ? 30 : 5, // seconds
        },
        statusCode,
      );
    }
  }

  return DynamicQueueHealthGuard;
}

/**
 * Decorator to apply health-based admission control to controllers or methods.
 *
 * Usage:
 * @UseHealthGuard() - Apply to entire controller (checks all queues or uses query param)
 * @UseHealthGuard('queueName') - Apply guard for specific queue
 * @UseGuards(HealthGuard) - Apply to specific methods
 */
export function UseHealthGuard(queueName: string) {
  return UseGuards(createQueueHealthGuard(queueName));
}
