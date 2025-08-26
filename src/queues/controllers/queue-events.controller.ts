/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Controller,
  Get,
  Post,
  Query,
  HttpCode,
  HttpStatus,
  Param,
  HttpException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { ModuleRef } from '@nestjs/core';
import { HealthService } from '../health/health-checker.service';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { RolesGuard } from '@presentation/guards/roles.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { RolesEnum } from '@shared/constants/enums';
import { DenyForRootReadOnly } from '@shared/decorators/root-readonly.decorator';

@ApiTags('queue-events')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('events')
@Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY)
export class QueueEventsController {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly healthService: HealthService,
  ) {}

  private getQueue(queueName: string): Queue {
    try {
      // Use the correct BullMQ token
      const queue = this.moduleRef.get<Queue>(`BullQueue_${queueName}`, { strict: false });
      if (!queue) {
        throw new HttpException(
          {
            status: 'error',
            message: `Queue '${queueName}' not found`,
            availableQueues: this.healthService.getQueueNames(),
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return queue;
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Queue '${queueName}' not found`,
          availableQueues: this.healthService.getQueueNames(),
        },
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Get('status')
  @ApiOperation({ summary: 'Get queue status' })
  @ApiResponse({ status: 200, description: 'Queue status retrieved successfully' })
  async getStatus(@Query('queue') queueName?: string) {
    if (!queueName) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Queue name is required',
          availableQueues: this.healthService.getQueueNames(),
          example: '/events/status?queue=queueName',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const queue = this.getQueue(queueName);

    const waiting = await queue.getWaiting();
    const failed = await queue.getFailed();
    const completed = await queue.getCompleted();
    const delayed = await queue.getDelayed();
    const active = await queue.getActive();

    const now = Date.now();
    const lastHour = now - 60 * 60 * 1000;
    const lastDay = now - 24 * 60 * 60 * 1000;
    const sixHours = 6 * 60 * 60 * 1000;

    const recentFailed = failed.filter(job => job.timestamp && job.timestamp > lastHour);
    const oldFailed = failed.filter(job => job.timestamp && job.timestamp < now - lastDay);
    const veryOldJobs = [...waiting, ...failed, ...active].filter(
      job => job.timestamp && now - job.timestamp > sixHours,
    );

    return {
      status: 'ok',
      queueName,
      timestamp: new Date().toISOString(),
      queue: {
        waiting: waiting.length,
        active: active.length,
        delayed: delayed.length,
        failed: failed.length,
        completed: completed.length,
        total: waiting.length + active.length + delayed.length + failed.length + completed.length,
      },
      metrics: {
        recentFailures: recentFailed.length,
        oldFailures: oldFailed.length,
        jobsOlderThan6Hours: veryOldJobs.length,
      },
      info: {
        note: 'Jobs with max attempts retry infinitely every 5s until completed',
        limits: {
          maxProcessingTime: '6 hours',
          retryInterval: '5 seconds',
        },
      },
    };
  }

  @Get('queues')
  @ApiOperation({ summary: 'List all queues with status' })
  @ApiResponse({ status: 200, description: 'All queues listed successfully' })
  async listQueues() {
    const queueList = [];

    const queueNames = this.healthService.getQueueNames();

    for (const name of queueNames) {
      try {
        const queue = this.getQueue(name);
        const counts = await queue.getJobCounts();
        queueList.push({
          name,
          counts,
          total: Object.values(counts).reduce((sum: number, count: any) => sum + (count || 0), 0),
        });
      } catch (error) {
        queueList.push({
          name,
          error: 'Queue not accessible',
          counts: null,
          total: 0,
        });
      }
    }

    return {
      timestamp: new Date().toISOString(),
      totalQueues: queueList.length,
      queues: queueList,
    };
  }

  @Get('queue/:name/status')
  @ApiOperation({ summary: 'Get specific queue status' })
  @ApiResponse({ status: 200, description: 'Queue status retrieved successfully' })
  async getQueueStatus(@Param('name') queueName: string) {
    return this.getStatus(queueName);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List jobs in queue' })
  @ApiResponse({ status: 200, description: 'Jobs listed successfully' })
  async listJobs(
    @Query('queue') queueName?: string,
    @Query('start') start: string = '0',
    @Query('end') end: string = '50',
    @Query('state') state: string = 'failed',
  ) {
    if (!queueName) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Queue name is required',
          availableQueues: this.healthService.getQueueNames(),
          example: '/events/jobs?queue=queueName&start=0&end=50&state=failed',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const queue = this.getQueue(queueName);

    const startIdx = parseInt(start);
    const endIdx = parseInt(end);

    if (isNaN(startIdx) || isNaN(endIdx) || startIdx < 0 || endIdx <= startIdx) {
      return {
        error: 'Invalid range. Use ?start=0&end=50',
        example: '/events/jobs?queue=queueName&start=0&end=50&state=failed',
      };
    }

    const maxRange = 100;
    if (endIdx - startIdx > maxRange) {
      return {
        error: `Range too large. Maximum ${maxRange} jobs per request.`,
        requested: endIdx - startIdx,
        maximum: maxRange,
      };
    }

    const validStates = ['waiting', 'active', 'delayed', 'failed', 'completed'];
    if (!validStates.includes(state)) {
      return {
        error: `Invalid state. Valid states: ${validStates.join(', ')}`,
        provided: state,
      };
    }

    let jobs: any[] = [];

    switch (state) {
      case 'waiting':
        jobs = await queue.getWaiting(startIdx, endIdx);
        break;
      case 'active':
        jobs = await queue.getActive(startIdx, endIdx);
        break;
      case 'delayed':
        jobs = await queue.getDelayed(startIdx, endIdx);
        break;
      case 'failed':
        jobs = await queue.getFailed(startIdx, endIdx);
        break;
      case 'completed':
        jobs = await queue.getCompleted(startIdx, endIdx);
        break;
    }

    const jobData = jobs.map(job => {
      const age = job.timestamp ? Date.now() - job.timestamp : null;

      return {
        id: job.id,
        name: job.name,
        state,
        data: job.data,
        attemptsMade: job.attemptsMade,
        maxAttempts: job.opts?.attempts,
        failedReason: job.failedReason,
        timestamp: job.timestamp,
        finishedOn: job.finishedOn,
        ageMinutes: age ? Math.round(age / 1000 / 60) : null,
        isOld: age ? age > 6 * 60 * 60 * 1000 : false,
      };
    });

    const counts = await queue.getJobCounts();

    return {
      queueName,
      jobs: jobData,
      state,
      pagination: {
        start: startIdx,
        end: endIdx,
        count: jobData.length,
        total: counts[state] || 0,
        hasMore: endIdx < (counts[state] || 0),
        nextStart: endIdx < (counts[state] || 0) ? endIdx : null,
        nextEnd:
          endIdx < (counts[state] || 0)
            ? Math.min(endIdx + (endIdx - startIdx), counts[state] || 0)
            : null,
      },
      allStates: counts,
    };
  }

  @Get('queue/:name/jobs')
  @ApiOperation({ summary: 'List jobs in specific queue' })
  @ApiResponse({ status: 200, description: 'Jobs listed successfully' })
  async listQueueJobs(
    @Param('name') queueName: string,
    @Query('start') start: string = '0',
    @Query('end') end: string = '50',
    @Query('state') state: string = 'failed',
  ) {
    return this.listJobs(queueName, start, end, state);
  }

  @Post('cleanup-old')
  @DenyForRootReadOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clean up old jobs' })
  @ApiResponse({ status: 200, description: 'Cleanup completed successfully' })
  async cleanupOldJobs(
    @Query('queue') queueName?: string,
    @Query('maxAgeHours') maxAgeParam: string = '6',
  ) {
    if (!queueName) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Queue name is required',
          availableQueues: this.healthService.getQueueNames(),
          example: '/events/cleanup-old?queue=queueName&maxAgeHours=6',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.performCleanup(queueName, maxAgeParam);
  }

  private async performCleanup(queueName: string, maxAgeParam: string = '6') {
    const queue = this.getQueue(queueName);
    const maxAgeHours = parseInt(maxAgeParam);

    if (isNaN(maxAgeHours) || maxAgeHours <= 0 || maxAgeHours > 24) {
      return {
        error: 'Invalid maxAgeHours. Must be between 1 and 24',
        provided: maxAgeParam,
        example: '6 (default: 6 hours)',
      };
    }

    const maxAge = maxAgeHours * 60 * 60 * 1000;
    const now = Date.now();
    let removed = 0;

    try {
      const [waiting, failed, completed] = await Promise.all([
        queue.getWaiting(0, -1),
        queue.getFailed(0, -1),
        queue.getCompleted(0, -1),
      ]);

      const allJobs = [...waiting, ...failed, ...completed];

      for (const job of allJobs) {
        const jobAge = job.timestamp ? now - job.timestamp : 0;
        if (jobAge > maxAge) {
          try {
            await job.remove();
            removed++;
          } catch (removeError) {
            // Silently ignore removal errors
          }
        }
      }

      return {
        status: 'success',
        queueName,
        message: `Cleanup completed: removed ${removed} jobs older than ${maxAgeHours} hours`,
        removed,
        maxAgeHours,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        queueName,
        message: 'Failed to cleanup old jobs',
        error: error instanceof Error ? error.message : String(error),
        removed,
      };
    }
  }

  @Post('queue/:name/cleanup-old')
  @DenyForRootReadOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clean up old jobs in specific queue' })
  @ApiResponse({ status: 200, description: 'Cleanup completed successfully' })
  async cleanupQueueOldJobs(
    @Param('name') queueName: string,
    @Query('maxAgeHours') maxAgeParam: string = '6',
  ) {
    return this.performCleanup(queueName, maxAgeParam);
  }

  @Post('cleanup-all')
  @DenyForRootReadOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clean up old jobs in all queues' })
  @ApiResponse({ status: 200, description: 'Cleanup completed for all queues' })
  async cleanupAllQueues(@Query('maxAgeHours') maxAgeParam: string = '6') {
    const results = [];

    for (const queueName of this.healthService.getQueueNames()) {
      const result = await this.performCleanup(queueName, maxAgeParam);
      results.push({ queue: queueName, ...result });
    }

    const totalRemoved = results.reduce((sum, r) => sum + (r.removed || 0), 0);

    return {
      status: 'success',
      message: `Cleanup completed for ${results.length} queues`,
      totalRemoved,
      maxAgeHours: parseInt(maxAgeParam),
      queues: results,
      timestamp: new Date().toISOString(),
    };
  }
}
