import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IBulkProcessingRequestRepository } from '@core/repositories/bulk-processing-request.repository.interface';
import { BULK_PROCESSING_REQUEST_REPOSITORY, LOGGER_SERVICE } from '@shared/constants/tokens';
import {
  BulkProcessingRequestNotFoundException,
  UnauthorizedBulkProcessingRequestAccessException,
  BulkProcessingInvalidStatusException,
} from '@core/exceptions/bulk-processing.exceptions';
import { ILogger } from '@core/interfaces/logger.interface';
import { BulkProcessingEventBus } from '@queues/all/bulk-processing/bulk-processing-event-bus';

export class CancelBulkProcessingCommand implements ICommand {
  constructor(
    public readonly requestId: string,
    public readonly companyId: string,
    public readonly userId: string,
    public readonly reason?: string,
  ) {}
}

@CommandHandler(CancelBulkProcessingCommand)
export class CancelBulkProcessingHandler
  implements ICommandHandler<CancelBulkProcessingCommand, void>
{
  constructor(
    @Inject(BULK_PROCESSING_REQUEST_REPOSITORY)
    private readonly bulkProcessingRequestRepository: IBulkProcessingRequestRepository,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
    private readonly bulkProcessingEventBus: BulkProcessingEventBus,
  ) {
    this.logger.setContext(CancelBulkProcessingHandler.name);
  }

  async execute(command: CancelBulkProcessingCommand): Promise<void> {
    const { requestId, companyId, userId, reason } = command;

    // Get the bulk processing request
    const bulkRequest = await this.bulkProcessingRequestRepository.findByIdAndCompany(
      requestId,
      companyId,
    );

    if (!bulkRequest) {
      throw new BulkProcessingRequestNotFoundException(requestId);
    }

    // Verify user has access
    if (!bulkRequest.belongsToCompany(companyId)) {
      throw new UnauthorizedBulkProcessingRequestAccessException(requestId, companyId);
    }

    // Check if already cancelled or cancelling
    if (bulkRequest.isCancelled()) {
      this.logger.log(`Bulk processing request ${requestId} is already cancelled`);

      return;
    }

    if (bulkRequest.isCancelling()) {
      this.logger.log(`Bulk processing request ${requestId} is already being cancelled`);

      return;
    }

    // Verify the request can be cancelled
    if (!bulkRequest.isCancellable()) {
      throw new BulkProcessingInvalidStatusException(requestId, bulkRequest.status, 'cancelled');
    }

    // First, set status to CANCELLING
    bulkRequest.startCancellation();
    await this.bulkProcessingRequestRepository.update(bulkRequest);

    this.logger.log(`Set bulk processing request ${requestId} to CANCELLING status`);

    // If there's a jobId, try to cancel the job in the queue
    if (bulkRequest.jobId) {
      try {
        const cancellationResult = await this.bulkProcessingEventBus.cancelJob(bulkRequest.jobId);

        if (cancellationResult.success) {
          this.logger.log(
            `Successfully cancelled job ${bulkRequest.jobId} for request ${requestId} by ${userId}. ` +
              `Previous state: ${cancellationResult.previousState}, Message: ${cancellationResult.message}`,
          );
        } else {
          this.logger.warn(
            `Could not cancel job ${bulkRequest.jobId} for request ${requestId}: ${cancellationResult.message}`,
          );
        }

        // Check if the job is active - if so, we need to wait for it to check the cancellation flag
        if (cancellationResult.previousState === 'active') {
          this.logger.log(
            `Job ${bulkRequest.jobId} is active and has been marked for cancellation. ` +
              `The processor should stop gracefully and handleJobCancellation will complete the process.`,
          );
        } else {
          // If job wasn't active (waiting, delayed, etc.), we may need to complete cancellation here
          // since the onJobFailed handler might not be called
          this.logger.log(
            `Job ${bulkRequest.jobId} was in ${cancellationResult.previousState} state and has been cancelled. ` +
              `Completing cancellation process.`,
          );

          // Complete the cancellation immediately since job won't run
          bulkRequest.cancel();
          await this.bulkProcessingRequestRepository.update(bulkRequest);
        }
      } catch (error) {
        // Log error but continue with cancellation
        this.logger.error(
          `Failed to cancel job ${bulkRequest.jobId} in queue for request ${requestId} by ${userId}: ${error}`,
        );
        throw new Error(
          `Failed to cancel job ${bulkRequest.jobId} in queue for request ${requestId}: ${error?.message ?? error}`,
        );
      }
    } else {
      // No job to cancel, complete cancellation immediately
      bulkRequest.cancel();
      await this.bulkProcessingRequestRepository.update(bulkRequest);
    }

    this.logger.log(
      `Initiated cancellation for bulk processing request: ${requestId} by user: ${userId} ` +
        `(company: ${companyId}, reason: ${reason || 'No reason provided'})`,
    );
  }
}
