import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailTemplates } from '@shared/services/email/email-templates';

@Injectable()
export class EmailProvider implements OnModuleInit {
  private transporter: nodemailer.Transporter;
  private transporterInitialized = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeTransporter();
  }

  private async initializeTransporter() {
    if (this.transporterInitialized) {
      return;
    }

    try {
      // If in development mode, create a test account
      const nodeEnv = this.configService.get('NODE_ENV');
      console.log('Current NODE_ENV:', nodeEnv);

      if (nodeEnv !== 'production') {
        const testAccount = await nodemailer.createTestAccount();

        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
      } else {
        // For production, use real SMTP settings from config
        this.transporter = nodemailer.createTransport({
          host: this.configService.get('smtp.host'),
          port: this.configService.get('smtp.port'),
          secure: this.configService.get('smtp.secure') === 'true',
          auth: {
            user: this.configService.get('smtp.user'),
            pass: this.configService.get('smtp.password'),
          },
        });
      }

      this.transporterInitialized = true;
    } catch (error) {
      console.error('Failed to initialize email transport:', error);
      throw error;
    }
  }

  /**
   * Get the transporter, initializing it if necessary
   */
  private async getTransporter(): Promise<nodemailer.Transporter> {
    if (!this.transporterInitialized) {
      await this.initializeTransporter();
    }

    return this.transporter;
  }

  /**
   * Send a verification code email to a user
   * @param email The recipient's email address
   * @param code The verification code to send
   * @returns Promise with the result of the operation
   */
  async sendVerificationCode(email: string, code: string): Promise<nodemailer.SentMessageInfo> {
    const transporter = await this.getTransporter();
    const appName = this.configService.get('appName', 'Our Application');

    const mailOptions = {
      from: `"${appName}" <${this.configService.get('smtp.from', 'noreply@example.com')}>`,
      to: email,
      subject: `Your ${appName} Verification Code`,
      text: `Your verification code is: ${code}. It will expire in 5 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Your Verification Code</h2>
          <p>Use the following code to verify your action:</p>
          <div style="background-color: #f4f4f4; padding: 15px; font-size: 24px;
               text-align: center; letter-spacing: 5px; font-weight: bold; margin: 20px 0;">
            ${code}
          </div>
          <p>This code will expire in 5 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <hr style="border: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #777; font-size: 12px;">This is an automated message, please do not reply.</p>
        </div>
      `,
    };

    const result = await transporter.sendMail(mailOptions);

    // For test accounts, log the preview URL
    if (this.configService.get('env') !== 'production') {
      // eslint-disable-next-line no-console
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(result));
    }

    return result;
  }

  /**
   * Send a password reset email to a user
   * @param email The recipient's email address
   * @param resetToken The password reset token
   * @returns Promise with the result of the operation
   */
  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
  ): Promise<nodemailer.SentMessageInfo> {
    const transporter = await this.getTransporter();
    const appName = this.configService.get('appName', 'Our Application');
    const frontendUrl = this.configService.get('frontend.url', 'https://example.com');
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    console.log('Sending password reset email to:', email);
    console.log('Reset link:', resetLink);

    const mailOptions = {
      from: `"${appName}" <${this.configService.get('smtp.from', 'noreply@example.com')}>`,
      to: email,
      subject: `Reset Your ${appName} Password`,
      text: `Click on the following link to reset your password: ${resetLink}. This link will expire in 1 hour.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Reset Your Password</h2>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}"
                style="background-color: #4CAF50; color: white; padding: 12px 25px;
                text-decoration: none; border-radius: 4px; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request a password reset, please ignore this email or contact support.</p>
          <hr style="border: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #777; font-size: 12px;">This is an automated message, please do not reply.</p>
        </div>
      `,
    };

    const result = await transporter.sendMail(mailOptions);

    // For test accounts, log the preview URL
    const nodeEnv = this.configService.get('NODE_ENV');
    if (nodeEnv !== 'production') {
      // eslint-disable-next-line no-console
      console.log('Password Reset Email Preview URL: %s', nodemailer.getTestMessageUrl(result));
    }

    return result;
  }

  /**
   * Send a welcome email to a new user with their password
   * @param email The recipient's email address
   * @param firstName The user's first name
   * @param password The user's generated password
   * @param companyName Optional company name
   * @returns Promise with the result of the operation
   */
  async sendWelcomeEmailWithPassword(
    email: string,
    firstName: string,
    password: string,
    companyName?: string,
  ): Promise<nodemailer.SentMessageInfo> {
    const transporter = await this.getTransporter();
    const appName = this.configService.get('APP_NAME', 'Nuestra Aplicación');

    const htmlContent = EmailTemplates.welcomeWithPassword(firstName, email, password, companyName);

    const mailOptions = {
      from: `"${appName}" <${this.configService.get('SMTP_FROM', 'noreply@example.com')}>`,
      to: email,
      subject: 'Bienvenido a la plataforma - Tus credenciales de acceso',
      html: htmlContent,
    };

    const result = await transporter.sendMail(mailOptions);

    // For test accounts, log the preview URL
    if (this.configService.get('NODE_ENV') !== 'production') {
      // eslint-disable-next-line no-console
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(result));
    }

    return result;
  }

  /**
   * Send a welcome email to a new user (without password)
   * @param email The recipient's email address
   * @param firstName The user's first name
   * @returns Promise with the result of the operation
   */
  async sendWelcomeEmail(email: string, firstName: string): Promise<nodemailer.SentMessageInfo> {
    const transporter = await this.getTransporter();
    const appName = this.configService.get('appName', 'Our Application');
    const loginLink = this.configService.get('frontend.url', 'https://example.com');

    const mailOptions = {
      from: `"${appName}" <${this.configService.get('smtp.from', 'noreply@example.com')}>`,
      to: email,
      subject: `Welcome to ${appName}!`,
      text: `Hi ${firstName}, welcome to ${appName}! We're excited to have you on board.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to ${appName}!</h2>
          <p>Hi ${firstName},</p>
          <p>We're excited to have you on board. Here are a few things you can do to get started:</p>
          <ul>
            <li>Complete your profile</li>
            <li>Explore the dashboard</li>
            <li>Connect with other users</li>
          </ul>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginLink}"
                style="background-color: #4CAF50; color: white; padding: 12px 25px;
                text-decoration: none; border-radius: 4px; font-weight: bold;">
              Get Started
            </a>
          </div>
          <p>If you have any questions, feel free to contact our support team.</p>
          <hr style="border: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #777; font-size: 12px;">This is an automated message, please do not reply.</p>
        </div>
      `,
    };

    const result = await transporter.sendMail(mailOptions);

    // For test accounts, log the preview URL
    if (this.configService.get('env') !== 'production') {
      // eslint-disable-next-line no-console
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(result));
    }

    return result;
  }

  /**
   * Envía un correo electrónico genérico
   * @param to destinatario
   * @param subject asunto
   * @param content contenido (texto o HTML)
   * @param isHtml si el contenido es HTML
   */
  async sendEmail(
    to: string,
    subject: string,
    content: string,
    isHtml: boolean = false,
  ): Promise<nodemailer.SentMessageInfo> {
    const transporter = await this.getTransporter();
    const appName = this.configService.get('appName', 'Nuestra Aplicación');
    const from = `${appName} <${this.configService.get('smtp.from', 'noreply@example.com')}>`;

    const mailOptions = {
      from,
      to,
      subject,
      text: isHtml ? undefined : content,
      html: isHtml ? content : undefined,
    };

    const result = await transporter.sendMail(mailOptions);

    // Para cuentas de test, mostrar la URL de previsualización
    if (this.configService.get('env') !== 'production') {
      // eslint-disable-next-line no-console
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(result));
    }

    return result;
  }
}
