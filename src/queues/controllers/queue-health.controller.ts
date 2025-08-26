/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Controller,
  Get,
  HttpStatus,
  HttpException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { HealthService } from '../health/health-checker.service';
import { getPerformanceConfig } from '../config/queue.config';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { RolesGuard } from '@presentation/guards/roles.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { RolesEnum } from '@shared/constants/enums';

@ApiTags('queue-health')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('healthz')
@Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY)
export class QueueHealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Kubernetes/Infrastructure liveness probe
   * Returns 200 if service is alive, 503 if health checks are stale
   */
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  @ApiResponse({ status: 503, description: 'Service unavailable' })
  async liveness(@Query('queue') queueName?: string) {
    const summary = this.healthService.getSummary(queueName);

    if (!summary) {
      throw new HttpException(
        {
          status: 'unhealthy',
          reason: 'No queues available for health monitoring',
          timestamp: new Date().toISOString(),
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (queueName && 'stale' in summary) {
      if (summary.stale) {
        throw new HttpException(
          {
            status: 'unhealthy',
            queue: queueName,
            reason: 'Health checks are stale',
            timestamp: new Date().toISOString(),
            details: {
              lastCheck: summary.lastCheck,
              staleFor: summary.lastCheck !== -1 ? Date.now() - Number(summary.lastCheck) : 0,
            },
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    } else if (!queueName) {
      const allSummaries = summary as any;
      const staleQueues = Object.entries(allSummaries)
        .filter(([, s]: any) => s.stale)
        .map(([name]) => name);

      if (staleQueues.length > 0) {
        throw new HttpException(
          {
            status: 'unhealthy',
            reason: 'Health checks are stale for some queues',
            staleQueues,
            timestamp: new Date().toISOString(),
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    }

    return {
      status: 'healthy',
      queue: queueName || 'all',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: this.configService.get<string>('apiVersion', 'v1'),
    };
  }

  /**
   * Kubernetes/Infrastructure readiness probe
   * Returns 200 if ready to accept traffic, 429 if overloaded
   */
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiResponse({ status: 200, description: 'Service ready' })
  @ApiResponse({ status: 429, description: 'Service overloaded' })
  async readiness(@Query('queue') queueName?: string) {
    const summary = this.healthService.getSummary(queueName);

    if (!summary) {
      throw new HttpException(
        {
          status: 'not_ready',
          reason: 'No queues available for health monitoring',
          timestamp: new Date().toISOString(),
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (queueName && 'stale' in summary) {
      if (summary.stale) {
        throw new HttpException(
          {
            status: 'not_ready',
            queue: queueName,
            reason: 'Health checks are stale',
            timestamp: new Date().toISOString(),
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      if (!summary.accepting) {
        throw new HttpException(
          {
            status: 'not_ready',
            queue: queueName,
            reason: 'System overloaded - admission control active',
            details: {
              reasons: summary.reason,
              limits: summary.limits,
              current: summary.pcts,
            },
            timestamp: new Date().toISOString(),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return {
        status: 'ready',
        queue: queueName,
        timestamp: new Date().toISOString(),
        accepting: true,
        metrics: {
          queueBacklog: Math.round(((summary as any).pcts?.backlog || 0) * 100),
          activeJobs: Math.round(((summary as any).pcts?.active || 0) * 100),
          redisMemory: Math.round(((summary as any).pcts?.redis || 0) * 100),
          latencyMs: summary.latencyMs,
        },
      };
    } else {
      const allSummaries = summary as any;
      const notReadyQueues: string[] = [];
      const staleQueues: string[] = [];

      for (const [name, s] of Object.entries(allSummaries) as any) {
        if (s.stale) {
          staleQueues.push(name);
        } else if (!s.accepting) {
          notReadyQueues.push(name);
        }
      }

      if (staleQueues.length > 0) {
        throw new HttpException(
          {
            status: 'not_ready',
            reason: 'Health checks are stale for some queues',
            staleQueues,
            timestamp: new Date().toISOString(),
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      if (notReadyQueues.length > 0) {
        throw new HttpException(
          {
            status: 'not_ready',
            reason: 'Some queues are overloaded',
            overloadedQueues: notReadyQueues,
            timestamp: new Date().toISOString(),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
        accepting: true,
        queues: Object.keys(allSummaries),
      };
    }
  }

  /**
   * Queue-specific health check
   */
  @Get('queue/:name')
  @ApiOperation({ summary: 'Get specific queue health' })
  @ApiResponse({ status: 200, description: 'Queue health details' })
  async queueHealth(@Param('name') queueName: string) {
    const summary = this.healthService.getSummary(queueName);

    if (!summary || !('stale' in summary)) {
      throw new HttpException(
        {
          status: 'not_found',
          message: `Queue '${queueName}' not found`,
          availableQueues: this.healthService.getQueueNames(),
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      queue: queueName,
      timestamp: new Date().toISOString(),
      health: {
        accepting: summary.accepting,
        stale: summary.stale,
        lastCheck: summary.lastCheck,
        reasons: summary.reason || [],
        pingFailures: summary.pingFailures,
      },
      metrics: {
        percentages: {
          queueBacklog: Math.round(((summary as any).pcts?.backlog || 0) * 100),
          activeJobs: Math.round(((summary as any).pcts?.active || 0) * 100),
          redisMemory: Math.round(((summary as any).pcts?.redis || 0) * 100),
        },
        absolute: {
          redisLatencyMs: summary.latencyMs,
          pingFailures: summary.pingFailures,
        },
      },
      limits: summary.limits,
    };
  }

  /**
   * List all monitored queues
   */
  @Get('queues')
  @ApiOperation({ summary: 'List all monitored queues' })
  @ApiResponse({ status: 200, description: 'List of all queues' })
  async listQueues() {
    const queueNames = this.healthService.getQueueNames();
    const summaries = this.healthService.getSummary();

    if (!summaries) {
      return {
        timestamp: new Date().toISOString(),
        totalQueues: 0,
        healthyQueues: 0,
        unhealthyQueues: 0,
        queues: [],
      };
    }

    const allSummaries = summaries as any;
    const queues = queueNames.map(name => ({
      name,
      accepting: allSummaries[name]?.accepting || false,
      stale: allSummaries[name]?.stale || false,
      lastCheck: allSummaries[name]?.lastCheck || -1,
    }));

    return {
      timestamp: new Date().toISOString(),
      totalQueues: queues.length,
      healthyQueues: queues.filter(q => q.accepting && !q.stale).length,
      unhealthyQueues: queues.filter(q => !q.accepting || q.stale).length,
      queues,
    };
  }

  /**
   * Detailed health information for monitoring/debugging
   */
  @Get('detail')
  @ApiOperation({ summary: 'Detailed health information' })
  @ApiResponse({ status: 200, description: 'Detailed health status' })
  async detail(@Query('queue') queueName?: string) {
    const summary = this.healthService.getSummary(queueName);
    const perf = getPerformanceConfig(this.configService);

    if (!summary) {
      return {
        timestamp: new Date().toISOString(),
        error: 'No queues available for health monitoring',
        process: {
          uptime: process.uptime(),
          pid: process.pid,
          version: process.version,
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
        },
      };
    }

    if (queueName && 'stale' in summary) {
      return {
        timestamp: new Date().toISOString(),
        queue: queueName,
        process: {
          uptime: process.uptime(),
          pid: process.pid,
          version: process.version,
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
        },
        health: {
          accepting: summary.accepting,
          stale: summary.stale,
          lastCheck: summary.lastCheck,
          reasons: summary.reason || [],
          pingFailures: summary.pingFailures,
        },
        metrics: {
          percentages: {
            queueBacklog: Math.round(((summary as any).pcts?.backlog || 0) * 100),
            activeJobs: Math.round(((summary as any).pcts?.active || 0) * 100),
            redisMemory: Math.round(((summary as any).pcts?.redis || 0) * 100),
          },
          absolute: {
            redisLatencyMs: summary.latencyMs,
            pingFailures: summary.pingFailures,
          },
        },
        limits: summary.limits,
        environment: {
          nodeEnv: this.configService.get<string>('env', 'development'),
          healthCheckInterval: perf.HEALTH_CHECK_INTERVAL,
          maxBacklog: perf.MAX_BACKLOG,
          maxActive: perf.MAX_ACTIVE,
        },
      };
    } else {
      const allSummaries = summary as any;
      const queueDetails: any = {};

      for (const [name, s] of Object.entries(allSummaries) as any) {
        queueDetails[name] = {
          accepting: s.accepting,
          stale: s.stale,
          lastCheck: s.lastCheck,
          reasons: s.reason || [],
          metrics: {
            queueBacklog: Math.round((s.pcts?.backlog || 0) * 100),
            activeJobs: Math.round((s.pcts?.active || 0) * 100),
            redisMemory: Math.round((s.pcts?.redis || 0) * 100),
            latencyMs: s.latencyMs,
          },
        };
      }

      return {
        timestamp: new Date().toISOString(),
        process: {
          uptime: process.uptime(),
          pid: process.pid,
          version: process.version,
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
        },
        queues: queueDetails,
        environment: {
          nodeEnv: this.configService.get<string>('env', 'development'),
          healthCheckInterval: perf.HEALTH_CHECK_INTERVAL,
          maxBacklog: perf.MAX_BACKLOG,
          maxActive: perf.MAX_ACTIVE,
        },
      };
    }
  }
}
