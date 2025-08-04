import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { VerifyEmailDto } from '@application/dtos/auth/email-verification.dto';
import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AuthService } from '@core/services/auth.service';
import { SessionService } from '@core/services/session.service';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { IRoleRepository } from '@core/repositories/role.repository.interface';
import { IAuthTokenResponse } from '@application/dtos/responses/user.response';
import { UserMapper } from '@application/mappers/user.mapper';
import { ITokenProvider } from '@core/interfaces/token-provider.interface';
import { USER_REPOSITORY, ROLE_REPOSITORY, TOKEN_PROVIDER } from '@shared/constants/tokens';

export class VerifyEmailCommand implements ICommand {
  constructor(public readonly dto: VerifyEmailDto) {}
}

@Injectable()
@CommandHandler(VerifyEmailCommand)
export class VerifyEmailCommandHandler
  implements ICommandHandler<VerifyEmailCommand, IAuthTokenResponse | { verified: boolean }>
{
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    @Inject(TOKEN_PROVIDER)
    private readonly tokenProvider: ITokenProvider,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
  ) {}

  async execute(command: VerifyEmailCommand): Promise<IAuthTokenResponse | { verified: boolean }> {
    const { email, code } = command.dto;

    // Verify the email code
    const verified = await this.authService.verifyEmailCode(email, code);

    if (!verified) {
      return { verified: false };
    }

    // If verification succeeded, we can immediately login the user
    // 1. Find the user by email
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // 2. Update last login
    await this.authService.updateLastLogin(user.id.getValue());

    // 3. Collect all permissions from all user roles
    const userPermissions = new Set<string>();
    for (const role of user.roles) {
      const roleWithPermissions = await this.roleRepository.findById(role.id.getValue());
      if (roleWithPermissions && roleWithPermissions.permissions) {
        roleWithPermissions.permissions.forEach(permission => {
          userPermissions.add(permission.getStringName());
        });
      }
    }

    // 4. Generate session token and JWT tokens
    const sessionToken = uuidv4();
    const { accessToken, refreshToken } = await this.tokenProvider.generateTokens(
      user,
      Array.from(userPermissions),
      sessionToken,
    );

    // 5. Register the session
    await this.sessionService.createSession(
      user.id.getValue(),
      sessionToken,
      refreshToken,
      null, // userAgent not available in email verification
      '?', // ipAddress not available in email verification
    );

    // 6. Return tokens and user information
    return {
      accessToken,
      refreshToken,
      user: UserMapper.toAuthResponse(user),
    };
  }
}
