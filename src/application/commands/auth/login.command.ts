import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { LoginDto } from '@application/dtos/auth/login.dto';
import { AuthResponse } from '@application/dtos/_responses/user/user.response';
import { UnauthorizedException, Injectable, Inject } from '@nestjs/common';
import { AuthenticationValidationService } from '@core/services/authentication-validation.service';
import { I18nService } from 'nestjs-i18n';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';

export class LoginCommand implements ICommand {
  constructor(
    public readonly loginDto: LoginDto,
    public readonly userAgent?: string,
    public readonly ipAddress?: string,
  ) {}
}

@Injectable()
@CommandHandler(LoginCommand)
export class LoginCommandHandler implements ICommandHandler<LoginCommand> {
  constructor(
    private readonly authValidationService: AuthenticationValidationService,
    private readonly i18n: I18nService,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(LoginCommandHandler.name);
  }

  async execute(command: LoginCommand): Promise<AuthResponse> {
    const { email, password } = command.loginDto;
    const { userAgent, ipAddress } = command;

    this.logger.log({
      message: 'Login attempt',
      email,
      ipAddress,
      userAgent,
    });

    // Delegate all validation and flow logic to the authentication service
    const loginResult = await this.authValidationService.validateLoginFlow(
      email,
      password,
      userAgent,
      ipAddress,
    );

    // Handle different outcomes
    if (!loginResult.success) {
      throw new UnauthorizedException(this.i18n.t('common.auth.login.failed'));
    }

    // Handle multi-step authentication flows
    if (loginResult.nextStep === 'email_verification') {
      return {
        requiresEmailVerification: true,
        userId: loginResult.userId!,
        email: loginResult.email!,
        message: this.i18n.t('common.auth.verification.email_sent'),
      };
    }

    if (loginResult.nextStep === 'otp_required') {
      return {
        requiresOtp: true,
        userId: loginResult.userId!,
        message: this.i18n.t('common.auth.2fa.enabled'),
      };
    }

    // Complete authentication
    if (loginResult.nextStep === 'complete' && loginResult.authResponse) {
      return {
        ...loginResult.authResponse,
        message: this.i18n.t('common.auth.login.success'),
      };
    }

    // This should never happen with proper validation service implementation
    throw new UnauthorizedException(this.i18n.t('common.auth.login.failed'));
  }
}
