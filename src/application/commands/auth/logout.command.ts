import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { AuthService } from '@core/services/auth.service';
import { SessionService } from '@core/services/session.service';
import { LogoutScope } from '@shared/constants/enums';
import { AUDIT_LOG_SERVICE } from '@shared/constants/tokens';
import { AuditLogService } from '@core/services/audit-log.service';
import { UserId } from '@core/value-objects/user-id.vo';

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
    @Inject(AUDIT_LOG_SERVICE)
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(command: LogoutCommand): Promise<{ message: string }> {
    const startTime = performance.now();
    const { userId, scope, currentSessionToken } = command;

    try {
      if (scope === LogoutScope.LOCAL) {
        if (!currentSessionToken) {
          throw new Error('Session token is required for local logout');
        }

        // Revoke only the current session
        await this.sessionService.revokeSession(currentSessionToken);

        const duration = performance.now() - startTime;

        // Audit log for successful local logout
        this.auditLogService.logAuth(
          'logout',
          'User logged out successfully from current session',
          UserId.fromString(userId),
          undefined,
          {
            userId,
            logoutScope: 'local',
            sessionToken: currentSessionToken,
            duration,
          },
          'info',
        );

        return { message: 'Logged out from current session successfully' };
      } else {
        // Global logout - revoke all sessions for the user
        await this.sessionService.revokeUserSessions(userId, 'global');
        // Also revoke all refresh tokens as a backup
        await this.authService.revokeAllRefreshTokens(userId);

        const duration = performance.now() - startTime;

        // Audit log for successful global logout
        this.auditLogService.logAuth(
          'logout',
          'User logged out successfully from all sessions',
          UserId.fromString(userId),
          undefined,
          {
            userId,
            logoutScope: 'global',
            duration,
          },
          'info',
        );

        return { message: 'Logged out from all sessions successfully' };
      }
    } catch (error) {
      const duration = performance.now() - startTime;

      // Audit log for failed logout
      this.auditLogService.logSecurity(
        'logout',
        `Logout failed for user: ${userId} - ${error.message}`,
        UserId.fromString(userId),
        undefined,
        {
          userId,
          logoutScope: scope,
          error: error.message,
          duration,
        },
        'error',
      );

      throw error;
    }
  }
}
