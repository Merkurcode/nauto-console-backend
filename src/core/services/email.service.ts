import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { EmailTemplates } from '@shared/services/email/email-templates';

export interface IEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly configService: ConfigService,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(EmailService.name);
    this.initializeTransporter();
  }

  private getPrimaryColor(): string {
    const color = this.configService.get<string>('email.templates.primaryColor', '#007bff');

    return color.startsWith('#') ? color : `#${color}`;
  }

  private getSecondaryColor(): string {
    const color = this.configService.get<string>('email.templates.secondaryColor', '#6c757d');

    return color.startsWith('#') ? color : `#${color}`;
  }

  private initializeTransporter(): void {
    const emailProvider = this.configService.get<string>('email.provider', 'mailhog');
    const nodeEnv = this.configService.get<string>('env', 'development');

    // SMTP configuration ONLY for development environment
    if (nodeEnv === 'development') {
      if (emailProvider === 'mailhog') {
        this.transporter = nodemailer.createTransport({
          host: this.configService.get<string>('smtp.host', 'localhost'),
          port: this.configService.get<number>('smtp.port', 1025),
          secure: false, // MailHog doesn't use SSL
          auth: undefined, // MailHog doesn't require auth
          tls: {
            rejectUnauthorized: false,
          },
        });
        this.logger.log('Email service initialized with MailHog for development');
      } else {
        // Development SMTP configuration (only when NODE_ENV=development)
        this.transporter = nodemailer.createTransport({
          host: this.configService.get<string>('smtp.host', 'localhost'),
          port: this.configService.get<number>('smtp.port', 587),
          secure: this.configService.get<boolean>('smtp.secure', false),
          auth: {
            user: this.configService.get<string>('smtp.user'),
            pass: this.configService.get<string>('smtp.password'),
          },
        });
        this.logger.log('Email service initialized with development SMTP');
      }
    } else {
      // Non-development environments: DO NOT use SMTP variables
      // Initialize with null transporter - forces use of provider-specific APIs only
      this.transporter = null;
      this.logger.log(
        'Email service initialized for production (SMTP disabled, API-based providers only)',
      );
    }
  }

  async sendEmail(options: IEmailOptions): Promise<boolean> {
    const emailProvider = this.configService.get<string>('email.provider', 'mailhog');
    const nodeEnv = this.configService.get<string>('env', 'development');

    // Route to appropriate provider based on environment and configuration
    if (emailProvider === 'resend') {
      // Use Resend API in any environment
      return this.sendEmailWithResend(options);
    }

    // Non-development environments: only API-based providers allowed
    if (nodeEnv !== 'development') {
      this.logger.error(
        `Unsupported email provider '${emailProvider}' in ${nodeEnv} environment. Only API-based providers are allowed.`,
      );
      throw new Error(
        `Email provider '${emailProvider}' is not supported in ${nodeEnv} environment. Use 'resend' or other API-based providers.`,
      );
    }

    // Development environment: use MailHog or SMTP for non-resend providers
    return this.sendEmailWithNodemailer(options);
  }

  private async sendEmailWithResend(options: IEmailOptions): Promise<boolean> {
    try {
      const resendApiKey = this.configService.get<string>('resend.apiKey');
      const resendApiUrl = this.configService.get<string>(
        'resend.apiUrl',
        'https://api.resend.com/emails',
      );
      const fromEmail = this.configService.get<string>(
        'resend.fromEmail',
        'nauto@notification.nocodeflows.io',
      );

      const res = await fetch(resendApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: options.to,
          subject: options.subject,
          html: options.html || options.text,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          `Resend API error: ${res.status} ${res.statusText} - ${JSON.stringify(errorData)}`,
        );
      }

      const result = await res.json();

      this.logger.log({
        message: 'Email sent successfully with Resend',
        to: options.to,
        subject: options.subject,
        messageId: result.id,
      });

      return true;
    } catch (error) {
      this.logger.error({
        message: 'Failed to send email with Resend',
        to: options.to,
        subject: options.subject,
        error: error.message,
      });

      return false;
    }
  }

  private async sendEmailWithNodemailer(options: IEmailOptions): Promise<boolean> {
    const nodeEnv = this.configService.get<string>('env', 'development');

    // Prevent SMTP usage in non-development environments
    if (nodeEnv !== 'development') {
      this.logger.error('SMTP/Nodemailer is not available in non-development environments');
      throw new Error(
        `SMTP/Nodemailer is disabled in ${nodeEnv} environment. Use API-based email providers only.`,
      );
    }

    if (!this.transporter) {
      this.logger.error('Email transporter is not initialized');
      throw new Error('Email transporter is not available. Check SMTP configuration.');
    }

    try {
      const mailOptions = {
        from: this.configService.get<string>('smtp.from', 'noreply@example.com'),
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      const result = await this.transporter.sendMail(mailOptions);

      this.logger.log({
        message: 'Email sent successfully with Nodemailer',
        to: options.to,
        subject: options.subject,
        messageId: result.messageId,
      });

      return true;
    } catch (error) {
      this.logger.error({
        message: 'Failed to send email with Nodemailer',
        to: options.to,
        subject: options.subject,
        error: error.message,
      });

      return false;
    }
  }

  async sendVerificationEmail(email: string, code: string): Promise<boolean> {
    const appName = this.configService.get<string>('appName');
    const primaryColor = this.getPrimaryColor();
    const expirationMinutes = this.configService.get<number>('otp.expiration', 5);

    const html = EmailTemplates.verificationEmail(code, primaryColor, appName, expirationMinutes);

    return this.sendEmail({
      to: email,
      subject: `Código de Verificación - ${appName}`,
      html,
    });
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    const frontendUrl = this.configService.get<string>('frontend.url');
    const passwordResetPath = this.configService.get<string>('frontend.passwordResetPath');
    const appName = this.configService.get<string>('appName');
    const primaryColor = this.getPrimaryColor();
    const expirationMinutes = this.configService.get<number>(
      'business.password.resetExpiryMinutes',
      30,
    );
    const resetLink = `${frontendUrl}${passwordResetPath}?token=${resetToken}`;

    const html = EmailTemplates.passwordResetEmail(
      resetLink,
      primaryColor,
      appName,
      expirationMinutes,
    );

    this.logger.log({
      message: 'Sending password reset email',
      email,
      resetLinkProvided: !!resetLink,
      resetLinkDomain: resetLink ? new URL(resetLink).hostname : null,
    });

    return this.sendEmail({
      to: email,
      subject: `Restablecer Contraseña - ${appName}`,
      html,
    });
  }

  async sendWelcomeEmail(
    email: string,
    firstName: string,
    companyName?: string,
    roles?: string[],
  ): Promise<boolean> {
    const appName = this.configService.get<string>('appName');
    const frontendUrl = this.configService.get<string>('frontend.url');
    const dashboardPath = this.configService.get<string>('frontend.dashboardPath');
    const primaryColor = this.getPrimaryColor();
    const supportEmail = this.configService.get<string>('email.supportEmail');
    const dashboardUrl = `${frontendUrl}${dashboardPath}`;
    const companyText = companyName ? ` de ${companyName}` : '';

    const html = EmailTemplates.welcomeEmail(
      firstName,
      appName,
      companyName,
      roles,
      dashboardUrl,
      primaryColor,
      supportEmail,
    );

    this.logger.log({
      message: 'Sending welcome email',
      email,
      firstName,
      companyName,
      roles,
    });

    return this.sendEmail({
      to: email,
      subject: `¡Bienvenido a ${appName}${companyText}!`,
      html,
    });
  }

  async sendWelcomeEmailWithPassword(
    email: string,
    firstName: string,
    password: string,
    companyName?: string,
    roles?: string[],
  ): Promise<boolean> {
    const appName = this.configService.get('appName', 'Nuestra Aplicación');
    const frontendUrl = this.configService.get('frontend.url', 'http://localhost:3000');
    const dashboardPath = this.configService.get('frontend.dashboardPath', '/dashboard');
    const dashboardUrl = `${frontendUrl}${dashboardPath}`;

    const colors = {
      primary: this.configService.get('email.templates.primaryColor', '007bff'),
      secondary: this.configService.get('email.templates.secondaryColor', '6c757d'),
    };

    const htmlContent = EmailTemplates.welcomeWithPassword(
      firstName,
      email,
      password,
      companyName,
      roles,
      dashboardUrl,
      colors,
      appName,
    );

    this.logger.log({
      message: 'Sending welcome email with password',
      email,
      firstName,
      companyName,
      roles,
      dashboardUrl,
    });

    return this.sendEmail({
      to: email,
      subject: 'Bienvenido a la plataforma - Tus credenciales de acceso',
      html: htmlContent,
    });
  }
}
