import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { LoggerService } from '@infrastructure/logger/logger.service';

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
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(EmailService.name);
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const emailProvider = this.configService.get<string>('email.provider', 'mailhog');
    const nodeEnv = this.configService.get<string>('env', 'development');

    // Use MailHog for development/local testing
    if (nodeEnv === 'development' || emailProvider === 'mailhog') {
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
      // Production SMTP configuration
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('smtp.host'),
        port: this.configService.get<number>('smtp.port', 587),
        secure: this.configService.get<boolean>('smtp.secure', false),
        auth: {
          user: this.configService.get<string>('smtp.user'),
          pass: this.configService.get<string>('smtp.password'),
        },
      });
      this.logger.log('Email service initialized with production SMTP');
    }
  }

  async sendEmail(options: IEmailOptions): Promise<boolean> {
    const nodeEnv = this.configService.get<string>('env', 'development');
    const emailProvider = this.configService.get<string>('email.provider', 'mailhog');
    const productionProvider = this.configService.get<string>('email.productionProvider', 'resend');

    // Use Resend for production
    if (nodeEnv === 'production' && productionProvider === 'resend') {
      return this.sendEmailWithResend(options);
    }

    // Use MailHog or SMTP for development/staging
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
    const frontendUrl = this.configService.get<string>('frontend.url', 'http://localhost:3000');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Verificación de Email</h2>
        <p>Tu código de verificación es:</p>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: #007bff; margin: 0; font-size: 32px; letter-spacing: 5px;">${code}</h1>
        </div>
        <p>Este código expira en 5 minutos.</p>
        <p>Si no solicitaste este código, puedes ignorar este email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">Este es un email automático, por favor no respondas.</p>
      </div>
    `;

    const text = `
      Verificación de Email
      
      Tu código de verificación es: ${code}
      
      Este código expira en 5 minutos.
      
      Si no solicitaste este código, puedes ignorar este email.
    `;

    return this.sendEmail({
      to: email,
      subject: 'Código de Verificación - Nauto Console',
      text,
      html,
    });
  }
}
