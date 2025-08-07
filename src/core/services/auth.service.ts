import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  USER_REPOSITORY,
  OTP_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
  EMAIL_VERIFICATION_REPOSITORY,
  PASSWORD_RESET_REPOSITORY,
  PASSWORD_RESET_ATTEMPT_REPOSITORY,
  LOGGER_SERVICE,
} from '@shared/constants/tokens';
import { User } from '../entities/user.entity';
import { Otp } from '../entities/otp.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { EmailVerification } from '../entities/email-verification.entity';
import { PasswordReset } from '../entities/password-reset.entity';
import { PasswordResetAttempt } from '../entities/password-reset-attempt.entity';
import { IUserRepository } from '../repositories/user.repository.interface';
import { IOtpRepository } from '../repositories/otp.repository.interface';
import { IRefreshTokenRepository } from '../repositories/refresh-token.repository.interface';
import { IEmailVerificationRepository } from '../repositories/email-verification.repository.interface';
import { IPasswordResetRepository } from '../repositories/password-reset.repository.interface';
import { IPasswordResetAttemptRepository } from '../repositories/password-reset-attempt.repository.interface';
import {
  EntityNotFoundException,
  OtpExpiredException,
  OtpInvalidException,
  AuthenticationException,
  InvalidInputException,
} from '@core/exceptions/domain-exceptions';
import { Email } from '@core/value-objects/email.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { Token } from '@core/value-objects/token.vo';
import { VerificationCode } from '@core/value-objects/verification-code.vo';
import { ILogger } from '@core/interfaces/logger.interface';
import { EmailService } from './email.service';
import { SessionService } from './session.service';
import { BusinessConfigurationService } from './business-configuration.service';

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(OTP_REPOSITORY)
    private readonly otpRepository: IOtpRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    @Inject(EMAIL_VERIFICATION_REPOSITORY)
    private readonly emailVerificationRepository: IEmailVerificationRepository,
    @Inject(PASSWORD_RESET_REPOSITORY)
    private readonly passwordResetRepository: IPasswordResetRepository,
    @Inject(PASSWORD_RESET_ATTEMPT_REPOSITORY)
    private readonly passwordResetAttemptRepository: IPasswordResetAttemptRepository,
    private readonly configService: ConfigService,
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
    private readonly emailService: EmailService,
    private readonly sessionService: SessionService,
    private readonly businessConfigService: BusinessConfigurationService,
  ) {
    this.logger.setContext(AuthService.name);
  }

  private get otpConfig() {
    const otpConfig = this.businessConfigService.getOtpConfig();

    return {
      secret: this.configService.get<string>('otp.secret'),
      expiration: otpConfig.expirationMinutes,
      step: this.configService.get<number>('otp.step', 30),
      digits: this.configService.get<number>('otp.digits', 6),
      maxAttempts: otpConfig.maxAttempts,
      secretLength: otpConfig.secretLength,
    };
  }

  private get tokenConfig() {
    return {
      refreshExpiration: parseInt(
        this.configService.get<string>('jwt.refreshExpiration', '7d').replace('d', ''),
        10,
      ),
    };
  }

  async generateOtp(userId: string): Promise<string> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new EntityNotFoundException('User', userId);
    }

    // Generate a temporary secret
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `App:${user.email}`,
    }).base32;

    // Create a new OTP entity
    const otp = new Otp(UserId.fromString(userId), secret, this.otpConfig.expiration);

    // Save the OTP
    await this.otpRepository.create(otp);

    // Generate a token using the secret
    return speakeasy.totp({
      secret,
      encoding: 'base32',
      step: this.otpConfig.step,
      digits: this.otpConfig.digits,
    });
  }

  async verifyOtp(userId: string, token: string): Promise<boolean> {
    this.logger.debug({ message: 'Verifying OTP', userId });

    const user = await this.userRepository.findById(userId);
    if (!user) {
      this.logger.warn({ message: 'User not found during OTP verification', userId });
      throw new EntityNotFoundException('User', userId);
    }

    const otp = await this.otpRepository.findByUserId(userId);
    if (!otp) {
      this.logger.warn({ message: 'OTP not found for user', userId });
      throw new EntityNotFoundException('OTP');
    }

    if (otp.isExpired()) {
      this.logger.warn({
        message: 'OTP has expired',
        userId,
        expiresAt: otp.expiresAt,
      });
      throw new OtpExpiredException();
    }

    const isValid = speakeasy.totp.verify({
      secret: otp.secret,
      encoding: 'base32',
      token,
      step: this.otpConfig.step,
      digits: this.otpConfig.digits,
    });

    if (isValid) {
      this.logger.log({ message: 'OTP verified successfully', userId });
      otp.markAsVerified();
      await this.otpRepository.update(otp);

      return true;
    } else {
      this.logger.warn({ message: 'Invalid OTP provided', userId });
      throw new OtpInvalidException();
    }
  }

  async setupTwoFactorAuth(userId: string): Promise<{ secret: string; qrCodeUrl: string }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new EntityNotFoundException('User', userId);
    }

    // Generate a new secret
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `App:${user.email}`,
    });

    // Save the secret to the user
    user.enableOtp(secret.base32);
    await this.userRepository.update(user);

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCodeUrl,
    };
  }

  async verifyTwoFactorToken(userId: string, token: string): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new EntityNotFoundException('User', userId);
    }

    if (!user.otpEnabled || !user.otpSecret) {
      throw new AuthenticationException('Two-factor authentication is not enabled for this user');
    }

    const isValid = speakeasy.totp.verify({
      secret: user.otpSecret,
      encoding: 'base32',
      token,
      step: this.otpConfig.step,
      digits: this.otpConfig.digits,
    });

    if (!isValid) {
      throw new OtpInvalidException();
    }

    return true;
  }

  async disableTwoFactorAuth(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new EntityNotFoundException('User', userId);
    }

    user.disableOtp();

    return this.userRepository.update(user);
  }

  async createRefreshToken(userId: string, token: string): Promise<RefreshToken> {
    // Delete any existing refresh tokens for this user
    await this.refreshTokenRepository.deleteByUserId(userId);

    // Create a new refresh token
    const refreshToken = new RefreshToken(
      UserId.fromString(userId),
      new Token(token),
      this.tokenConfig.refreshExpiration,
    );

    return this.refreshTokenRepository.create(refreshToken);
  }

  async validateRefreshToken(token: string): Promise<RefreshToken> {
    this.logger.debug({ message: 'Validating refresh token' });

    const refreshToken = await this.refreshTokenRepository.findByToken(token);
    if (!refreshToken) {
      this.logger.warn({ message: 'Invalid refresh token, token not found in database' });
      throw new AuthenticationException('Invalid refresh token');
    }

    if (refreshToken.isExpired()) {
      this.logger.warn({
        message: 'Refresh token has expired',
        userId: refreshToken.userId.getValue(),
        expiresAt: refreshToken.expiresAt,
      });
      throw new AuthenticationException('Refresh token has expired');
    }

    if (refreshToken.isRevoked()) {
      this.logger.warn({
        message: 'Refresh token has been revoked',
        userId: refreshToken.userId.getValue(),
        revokedAt: refreshToken.revokedAt,
      });
      throw new AuthenticationException('Refresh token has been revoked');
    }

    this.logger.debug({
      message: 'Refresh token validated successfully',
      userId: refreshToken.userId.getValue(),
    });

    return refreshToken;
  }

  async revokeRefreshToken(token: string): Promise<void> {
    const refreshToken = await this.refreshTokenRepository.findByToken(token);
    if (!refreshToken) {
      throw new AuthenticationException('Invalid refresh token');
    }

    if (refreshToken.isRevoked()) {
      // The Token is already revoked, no action needed
      return;
    }

    refreshToken.revoke();
    await this.refreshTokenRepository.update(refreshToken);
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    // Check if user exists
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new EntityNotFoundException('User', userId);
    }

    await this.refreshTokenRepository.deleteByUserId(userId);
  }

  async updateLastLogin(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new EntityNotFoundException('User', userId);
    }

    user.updateLastLogin();

    return this.userRepository.update(user);
  }

  /**
   * Generate a verification code for email verification
   * @param email The email to send verification to
   * @returns The generated verification code
   */
  async generateEmailVerificationCode(email: string): Promise<string> {
    try {
      // Validate email format
      const emailVO = new Email(email);

      // SECURITY: Verify that the email is registered in the system
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        throw new EntityNotFoundException('User with this email is not registered', email);
      }

      // Delete any existing verification codes for this email
      await this.emailVerificationRepository.deleteByEmail(email);

      // Generate a 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      // Create and save the verification entity
      const emailVerification = new EmailVerification(
        emailVO,
        new VerificationCode(code),
        this.configService.get<number>('otp.expiration', 5),
      );

      await this.emailVerificationRepository.create(emailVerification);

      return code;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify an email verification code
   * @param email The email to verify
   * @param code The verification code
   * @returns Boolean indicating if verification was successful
   */
  async verifyEmailCode(email: string, code: string): Promise<boolean> {
    try {
      // Validate email format
      new Email(email);

      // Find the verification record
      const verification = await this.emailVerificationRepository.findByEmailAndCode(email, code);

      if (!verification) {
        throw new OtpInvalidException();
      }

      if (verification.isExpired()) {
        throw new OtpExpiredException();
      }

      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        throw new EntityNotFoundException('User', `${email}`);
      }

      // Mark as verified
      verification.markAsVerified();
      await this.emailVerificationRepository.update(verification);

      // Mark user email as verified
      user.markEmailAsVerified();
      await this.userRepository.update(user);

      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if an email is verified
   * @param email The email to check
   * @returns Boolean indicating if the email is verified
   */
  async isEmailVerified(email: string): Promise<boolean> {
    try {
      // Validate email format
      new Email(email);

      // Find the verification record
      const verification = await this.emailVerificationRepository.findByEmail(email);

      return verification ? verification.isVerified() : false;
    } catch (error) {
      if (error instanceof EntityNotFoundException) {
        return false; // Email not found, consider it unverified
      }

      return false;
    }
  }

  /**
   * Create a password reset token for a user with rate limiting
   * @param email The email of the user
   * @param ipAddress The IP address of the requester
   * @param userAgent The user agent of the requester
   * @returns The generated password reset token
   * @throws EntityNotFoundException if user not found
   * @throws ValidationException if rate limit exceeded
   */
  async createPasswordResetToken(
    email: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string> {
    try {
      // Validate email format
      new Email(email);

      // Check rate limits before proceeding
      await this.checkPasswordResetRateLimit(email, ipAddress);

      // Find the user
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        // Still record the attempt even if user doesn't exist for security monitoring
        await this.recordPasswordResetAttempt(email, ipAddress, userAgent);
        throw new EntityNotFoundException('User', `with email ${email}`);
      }

      // Record the password reset attempt
      await this.recordPasswordResetAttempt(email, ipAddress, userAgent);

      // Delete any existing password reset tokens for this user
      await this.passwordResetRepository.deleteByUserId(user.id.getValue());

      // Create a new password reset token
      const passwordReset = new PasswordReset(
        user.id,
        new Email(email),
        60, // 1-hour expiration
      );

      await this.passwordResetRepository.create(passwordReset);

      this.logger.log({
        message: 'Password reset token created',
        email,
        userId: user.id.getValue(),
        ipAddress,
      });

      return passwordReset.token.getValue();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if password reset rate limits are exceeded
   * @param email The email to check
   * @param ipAddress The IP address to check
   * @throws ValidationException if rate limit exceeded
   */
  private async checkPasswordResetRateLimit(email: string, ipAddress?: string): Promise<void> {
    const rateLimitConfig = this.businessConfigService.getRateLimitingConfig();
    const maxAttemptsPerEmail = rateLimitConfig.maxAttemptsPerEmail;
    const maxAttemptsPerIp = rateLimitConfig.maxAttemptsPerIp;

    // Check email-based rate limit (3 attempts per day)
    const emailAttemptCount = await this.passwordResetAttemptRepository.countByEmailToday(email);
    if (emailAttemptCount >= maxAttemptsPerEmail) {
      this.logger.warn({
        message: 'Password reset rate limit exceeded for email',
        email,
        attemptCount: emailAttemptCount,
        maxAttempts: maxAttemptsPerEmail,
      });
      throw new InvalidInputException(
        'Password reset limit exceeded. Please try again tomorrow or contact support.',
      );
    }

    // Check IP-based rate limit (10 attempts per day) if IP is provided
    if (ipAddress) {
      const ipAttemptCount = await this.passwordResetAttemptRepository.countByIpToday(ipAddress);
      if (ipAttemptCount >= maxAttemptsPerIp) {
        this.logger.warn({
          message: 'Password reset rate limit exceeded for IP',
          ipAddress,
          attemptCount: ipAttemptCount,
          maxAttempts: maxAttemptsPerIp,
        });
        throw new InvalidInputException(
          'Too many password reset attempts from this location. Please try again tomorrow.',
        );
      }
    }
  }

  /**
   * Record a password reset attempt for rate limiting
   * @param email The email of the attempt
   * @param ipAddress The IP address of the attempt
   * @param userAgent The user agent of the attempt
   */
  private async recordPasswordResetAttempt(
    email: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      const attempt = PasswordResetAttempt.create(email, ipAddress, userAgent);
      await this.passwordResetAttemptRepository.create(attempt);

      this.logger.debug({
        message: 'Password reset attempt recorded',
        email,
        ipAddress,
        attemptId: attempt.id,
      });
    } catch (error) {
      // Log the error but don't fail the main operation
      this.logger.error({
        message: 'Failed to record password reset attempt',
        email,
        ipAddress,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Validate a password reset token
   * @param token The password reset token
   * @returns The user associated with the token
   * @throws EntityNotFoundException if token not found
   * @throws OtpExpiredException if token is expired
   * @throws OtpInvalidException if token is already used
   */
  async validatePasswordResetToken(token: string): Promise<User> {
    // Find the password reset record
    const passwordReset = await this.passwordResetRepository.findByToken(token);
    if (!passwordReset) {
      throw new EntityNotFoundException('Password reset token', token);
    }

    // Check if the token is expired
    if (passwordReset.isExpired()) {
      throw new OtpExpiredException();
    }

    // Check if token is already used
    if (passwordReset.isUsed()) {
      throw new OtpInvalidException();
    }

    // Find the user
    const user = await this.userRepository.findById(passwordReset.userId.getValue());
    if (!user) {
      throw new EntityNotFoundException('User', passwordReset.userId.getValue());
    }

    return user;
  }

  /**
   * Reset a user's password
   * @param token The password reset token
   * @param newPassword The new password
   * @returns Boolean indicating success
   * @throws EntityNotFoundException if token not found
   * @throws OtpExpiredException if token is expired
   * @throws OtpInvalidException if token is already used
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    this.logger.log({ message: 'Password reset requested with token' });

    // Validate the token and get the user
    const user = await this.validatePasswordResetToken(token);

    this.logger.debug({
      message: 'Password reset token validated',
      userId: user.id,
      email: user.email,
    });

    // Get the password reset record
    const passwordReset = await this.passwordResetRepository.findByToken(token);

    // Set the new password
    user.changePassword(newPassword);
    await this.userRepository.update(user);

    // Mark the token as used
    passwordReset.markAsUsed();
    await this.passwordResetRepository.update(passwordReset);

    // Revoke all refresh tokens for this user
    await this.refreshTokenRepository.deleteByUserId(user.id.getValue());

    // Revoke all sessions for this user (global logout)
    await this.sessionService.revokeUserSessions(user.id.getValue(), 'global');

    // Clear any pending OTPs for this user (security measure)
    const existingOtp = await this.otpRepository.findByUserId(user.id.getValue());
    if (existingOtp) {
      await this.otpRepository.delete(existingOtp.id);
    }

    this.logger.log({
      message: 'Password reset completed successfully - all sessions, tokens, and OTPs revoked',
      userId: user.id,
      email: user.email,
    });

    return true;
  }

  /**
   * Process password reset request with captcha validation, rate limiting and email sending
   * @param email The email of the user
   * @param captchaToken The captcha token to validate
   * @param ipAddress The IP address of the requester
   * @param userAgent The user agent of the requester
   * @returns Promise<boolean> indicating if the process was successful
   * @throws InvalidInputException if captcha is invalid or rate limit exceeded
   */
  async processPasswordResetRequest(
    email: string,
    captchaToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<boolean> {
    this.logger.log({
      message: 'Processing password reset request',
      email,
      ipAddress,
    });

    try {
      // Create password reset token with rate limiting
      const token = await this.createPasswordResetToken(email, ipAddress, userAgent);

      // Send password reset email
      const emailSent = await this.emailService.sendPasswordResetEmail(email, token);

      if (!emailSent) {
        this.logger.error({
          message: 'Failed to send password reset email',
          email,
        });
        throw new Error('Failed to send password reset email');
      }

      this.logger.log({
        message: 'Password reset process completed successfully',
        email,
        ipAddress,
      });

      return true;
    } catch (error) {
      this.logger.error({
        message: 'Password reset process failed',
        email,
        ipAddress,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
