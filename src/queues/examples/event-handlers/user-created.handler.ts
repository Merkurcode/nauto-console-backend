/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Logger } from '@nestjs/common';
import { IEventHandler } from '../../types';
import { MQSerializableEvent, MQSerializableEventHandler } from '../../registry/event-registry';

@MQSerializableEvent('UserCreatedEvent')
export class UserCreatedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly timestamp: Date = new Date(),
  ) {}

  static fromJSON(data: any): UserCreatedEvent {
    return new UserCreatedEvent(data.userId, data.email, new Date(data.timestamp));
  }
}

@Injectable()
@MQSerializableEventHandler(UserCreatedEvent)
export class UserCreatedHandler implements IEventHandler {
  private readonly logger = new Logger(UserCreatedHandler.name);

  async handle(event: UserCreatedEvent): Promise<void> {
    this.logger.log(`Processing UserCreatedEvent for user: ${event.userId}`);

    try {
      // Example processing logic
      await this.sendWelcomeEmail(event.email);
      await this.createUserProfile(event.userId);
      await this.sendAnalyticsEvent(event);

      this.logger.log(`Successfully processed UserCreatedEvent for user: ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process UserCreatedEvent for user ${event.userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error; // Re-throw to trigger retry
    }
  }

  private async sendWelcomeEmail(email: string): Promise<void> {
    // Simulate email sending
    this.logger.debug(`Sending welcome email to: ${email}`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  private async createUserProfile(userId: string): Promise<void> {
    // Simulate profile creation
    this.logger.debug(`Creating user profile for: ${userId}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private async sendAnalyticsEvent(event: UserCreatedEvent): Promise<void> {
    // Simulate analytics event
    this.logger.debug(`Sending analytics event for user: ${event.userId}`);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}
