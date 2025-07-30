import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RequestPasswordResetDto } from '@application/dtos/auth/password-reset.dto';
import { Injectable } from '@nestjs/common';
import { AuthService } from '@core/services/auth.service';
import { CaptchaService } from '@core/services/captcha.service';
import { EntityNotFoundException, InvalidInputException } from '@core/exceptions/domain-exceptions';

export class RequestPasswordResetCommand implements ICommand {
  constructor(
    public readonly dto: RequestPasswordResetDto,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}

@Injectable()
@CommandHandler(RequestPasswordResetCommand)
export class RequestPasswordResetCommandHandler
  implements ICommandHandler<RequestPasswordResetCommand, { message: string }>
{
  constructor(
    private readonly authService: AuthService,
    private readonly captchaService: CaptchaService,
  ) {}

  async execute(command: RequestPasswordResetCommand): Promise<{ message: string }> {
    const { email, captchaToken } = command.dto;
    const { ipAddress, userAgent } = command;

    try {
      // Validate captcha first
      const isCaptchaValid = await this.captchaService.validateCaptcha(captchaToken);
      if (!isCaptchaValid) {
        throw new InvalidInputException('Invalid captcha. Please try again.');
      }

      // Process the password reset request (includes rate limiting and email sending)
      await this.authService.processPasswordResetRequest(email, captchaToken, ipAddress, userAgent);

      return { message: 'Password reset email sent successfully' };
    } catch (error) {
      if (error instanceof EntityNotFoundException) {
        // For security reasons, we don't want to reveal whether an email exists in our system
        return {
          message:
            'If your email exists in our system, you will receive a password reset link shortly',
        };
      }
      if (error instanceof InvalidInputException) {
        // Re-throw validation errors (rate limiting, captcha) to inform the user
        throw error;
      }
      throw error;
    }
  }
}
