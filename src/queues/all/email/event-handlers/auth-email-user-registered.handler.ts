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
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { NotificationStatus } from '@prisma/client';

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
    public readonly profilePhoneCountryCode?: string,
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
      data.profilePhoneCountryCode,
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
      profilePhoneCountryCode: this.profilePhoneCountryCode,
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
    private readonly prisma: PrismaService,
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

      // Update email status to SENT
      await this.prisma.user.update({
        where: { id: event.userId },
        data: {
          emailStatus: NotificationStatus.SENT,
          lastEmailError: null,
        },
      });

      this.logger.log({
        message: 'Email sent successfully and status updated',
        userId: event.userId,
        email: event.emailStr,
      });
    } catch (error) {
      this.logger.error({
        message: 'Error sending welcome email',
        email: event.emailStr,
        error: error.message,
      });

      // Update email status to SEND_ERROR
      await this.prisma.user.update({
        where: { id: event.userId },
        data: {
          emailStatus: NotificationStatus.SEND_ERROR,
          lastEmailError: error.message || 'Unknown error occurred while sending email',
        },
      });

      throw error; // Re-throw to allow retry logic
    }
  }

  private async sendWelcomeSms(event: AuthEmailUserRegisteredEvent): Promise<void> {
    // Send welcome SMS if user has phone number
    try {
      if (event.profilePhone) {
        const frontendUrl = this.configService.get('frontend.url', 'http://localhost:3000');
        const dashboardPath = this.configService.get('frontend.dashboardPath', '/dashboard');
        const dashboardUrl = `${frontendUrl}${dashboardPath}`;

        await this.smsService.sendWelcomeSms(
          event.profilePhone,
          event.firstName,
          event.actualPassword!,
          event.profilePhoneCountryCode,
          dashboardUrl,
        );

        // Update SMS status to SENT
        await this.prisma.user.update({
          where: { id: event.userId },
          data: {
            smsStatus: NotificationStatus.SENT,
            lastSmsError: null,
          },
        });

        this.logger.log({
          message: 'SMS sent successfully and status updated',
          userId: event.userId,
          phone: event.profilePhone,
        });
      } else {
        this.logger.debug({
          message: 'User has no phone configured, skipping welcome SMS',
          email: event.emailStr,
        });

        // Keep SMS status as NOT_PROVIDED since no phone was provided
        await this.prisma.user.update({
          where: { id: event.userId },
          data: {
            smsStatus: NotificationStatus.NOT_PROVIDED,
          },
        });
      }
    } catch (error) {
      this.logger.error({
        message: 'Error sending welcome SMS',
        phone: event.profilePhone,
        error: error.message,
      });

      // Update SMS status to SEND_ERROR
      await this.prisma.user.update({
        where: { id: event.userId },
        data: {
          smsStatus: NotificationStatus.SEND_ERROR,
          lastSmsError: error.message || 'Unknown error occurred while sending SMS',
        },
      });

      throw error; // Re-throw to allow retry logic
    }
  }
}
