import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { AuthService } from '@core/services/auth.service';
import { SessionService } from '@core/services/session.service';
import { LogoutScope } from '@shared/constants/enums';

export class LogoutCommand implements ICommand {
  constructor(
    public readonly userId: string,
    public readonly scope: LogoutScope = LogoutScope.GLOBAL,
    public readonly currentSessionToken?: string,
  ) {}
}

@Injectable()
@CommandHandler(LogoutCommand)
export class LogoutCommandHandler implements ICommandHandler<LogoutCommand, { message: string }> {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
  ) {}

  async execute(command: LogoutCommand): Promise<{ message: string }> {
    const { userId, scope, currentSessionToken } = command;

    if (scope === LogoutScope.LOCAL) {
      if (!currentSessionToken) {
        throw new Error('Session token is required for local logout');
      }

      // Revoke only the current session
      await this.sessionService.revokeSession(currentSessionToken);

      return { message: 'Logged out from current session successfully' };
    } else {
      // Global logout - revoke all sessions for the user
      await this.sessionService.revokeUserSessions(userId, 'global');
      // Also revoke all refresh tokens as a backup
      await this.authService.revokeAllRefreshTokens(userId);

      return { message: 'Logged out from all sessions successfully' };
    }
  }
}
