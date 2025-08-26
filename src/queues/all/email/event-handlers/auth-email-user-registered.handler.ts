/* eslint-disable @typescript-eslint/no-explicit-any */
import { Inject, Injectable } from '@nestjs/common';
import {
  MQSerializableEvent,
  MQSerializableEventHandler,
} from 'src/queues/registry/event-registry';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { IEventHandler } from 'src/queues/types';
import { EmailService } from '@core/services/email.service';
import { SmsService } from '@core/services/sms.service';
import { ConfigService } from '@nestjs/config';

@MQSerializableEvent('AuthEmailUserRegisteredEvent')
export class AuthEmailUserRegisteredEvent {
  constructor(
    public readonly userId: string,
    public readonly emailStr: string,
    public readonly firstName: string,
    public readonly actualPassword: string,
    public readonly roleNames: string[],
    public readonly profilePhone?: string,
    public readonly companyName?: string,
  ) {}

  static fromJSON(data: Record<string, any>): AuthEmailUserRegisteredEvent {
    return new AuthEmailUserRegisteredEvent(
      data.userId,
      data.emailStr,
      data.firstName,
      data.actualPassword,
      Array.isArray(data.roleNames) ? data.roleNames : [data.roleNames].filter(Boolean),
      data.profilePhone,
      data.companyName,
    );
  }

  toJSON(): Record<string, any> {
    return {
      userId: this.userId,
      emailStr: this.emailStr,
      firstName: this.firstName,
      actualPassword: this.actualPassword,
      roleNames: this.roleNames,
      profilePhone: this.profilePhone,
      companyName: this.companyName,
    };
  }
}

@Injectable()
@MQSerializableEventHandler(AuthEmailUserRegisteredEvent)
export class AuthEmailUserCreatedHandler implements IEventHandler {
  constructor(
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly configService: ConfigService,
  ) {}

  async handle(event: AuthEmailUserRegisteredEvent): Promise<void> {
    this.logger.log(`Processing AuthEmailUserCreatedHandler for user: ${event.userId}`);
    await this.sendWelcomeEmailWithPassword(event);
    await this.sendWelcomeSms(event);
  }

  private async sendWelcomeEmailWithPassword(event: AuthEmailUserRegisteredEvent): Promise<void> {
    try {
      this.logger.log({
        message: 'Sending welcome email with extended data by queue job',
        email: event.emailStr,
        firstName: event.firstName,
        roles: event.roleNames,
        companyName: event.companyName,
      });
      await this.emailService.sendWelcomeEmailWithPassword(
        event.emailStr,
        event.firstName,
        event.actualPassword!,
        event.companyName,
        event.roleNames,
      );
    } catch (error) {
      this.logger.error({
        message: 'Error sending welcome email',
        email: event.emailStr,
        error: error.message,
      });
    }
  }

  private async sendWelcomeSms(event: AuthEmailUserRegisteredEvent): Promise<void> {
    // Send welcome SMS if user has phone number
    try {
      if (event.profilePhone) {
        this.logger.log({
          message: 'Sending welcome SMS to user with extended data by queue job',
          phone: event.profilePhone,
          firstName: event.firstName,
        });

        const frontendUrl = this.configService.get('frontend.url', 'http://localhost:3000');
        const dashboardPath = this.configService.get('frontend.dashboardPath', '/dashboard');
        const dashboardUrl = `${frontendUrl}${dashboardPath}`;

        await this.smsService.sendWelcomeSms(
          event.profilePhone,
          event.firstName,
          event.actualPassword!,
          dashboardUrl,
          event.userId,
        );
      } else {
        this.logger.debug({
          message: 'User has no phone configured, skipping welcome SMS',
          email: event.emailStr,
        });
      }
    } catch (error) {
      this.logger.error({
        message: 'Error sending welcome SMS',
        phone: event.profilePhone,
        error: error.message,
      });
    }
  }
}
