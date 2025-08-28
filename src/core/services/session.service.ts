import { Injectable, Inject } from '@nestjs/common';
import { Session } from '@core/entities/session.entity';
import { UserId } from '@core/value-objects/user-id.vo';
import { ISessionRepository } from '@core/repositories/session.repository.interface';
import { InvalidSessionException } from '@core/exceptions/domain-exceptions';
import { SESSION_REPOSITORY, LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { BusinessConfigurationService } from './business-configuration.service';
import { SecurityLogger } from '@shared/utils/security-logger.util';

@Injectable()
export class SessionService {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository,
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
    private readonly businessConfigService: BusinessConfigurationService,
  ) {
    this.logger.setContext(SessionService.name);
  }

  async createSession(
    userId: string,
    sessionToken: string,
    refreshToken: string,
    userAgent: string | null,
    ipAddress: string,
  ): Promise<Session> {
    this.logger.debug({
      message: 'Creating new session',
      userId,
      ipAddress,
      userAgent,
    });

    // Check and enforce maximum active sessions
    await this.enforceMaxActiveSessions(userId);

    const session = Session.create(
      UserId.fromString(userId),
      sessionToken,
      refreshToken,
      userAgent,
      ipAddress,
    );

    const createdSession = await this.sessionRepository.create(session);

    this.logger.log({
      message: 'Session created successfully',
      sessionId: createdSession.id.getValue(),
      userId,
    });

    return createdSession;
  }

  async validateSessionToken(sessionToken: string): Promise<Session> {
    this.logger.debug({ message: 'Validating session token' });

    // SECURITY: Validate token format before database query
    if (!sessionToken || sessionToken.length < 32) {
      throw new InvalidSessionException('Invalid session token format');
    }

    const session = await this.sessionRepository.findBySessionToken(sessionToken);
    if (!session) {
      // Session not found - will be handled by guard
      // SECURITY: Don't reveal whether token exists or not
      this.logger.warn({ message: 'Session validation failed' });
      throw new InvalidSessionException('Invalid or expired session');
    }

    this.logger.debug({
      message: 'Session token validated successfully',
      sessionId: session.id.getValue(),
      userId: session.userId.getValue(),
    });

    return session;
  }

  async validateRefreshToken(refreshToken: string): Promise<Session> {
    this.logger.debug({ message: 'Validating refresh token' });

    // SECURITY: Validate token format before database query
    if (!refreshToken || refreshToken.length < 32) {
      throw new InvalidSessionException('Invalid refresh token format');
    }

    const session = await this.sessionRepository.findByRefreshToken(refreshToken);
    if (!session) {
      // Session not found - will be handled by guard
      // SECURITY: Don't reveal whether token exists or not
      this.logger.warn({ message: 'Refresh token validation failed' });
      throw new InvalidSessionException('Invalid or expired refresh token');
    }

    this.logger.debug({
      message: 'Refresh token validated successfully',
      sessionId: session.id.getValue(),
      userId: session.userId.getValue(),
    });

    return session;
  }

  async updateSessionActivity(sessionToken: string): Promise<void> {
    const session = await this.sessionRepository.findBySessionToken(sessionToken);
    if (!session) {
      return; // Session not found, nothing to update
    }

    session.updateActivity();
    await this.sessionRepository.update(session);
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    return this.sessionRepository.findByUserId(userId);
  }

  async revokeSession(sessionToken: string): Promise<void> {
    this.logger.debug({
      message: 'Revoking session',
      sessionTokenHash: SecurityLogger.maskSessionToken(sessionToken),
    });

    const session = await this.sessionRepository.findBySessionToken(sessionToken);
    if (!session) {
      this.logger.warn({
        message: 'Session not found for revocation',
        sessionTokenHash: SecurityLogger.maskSessionToken(sessionToken),
      });

      return;
    }

    const userId = session.userId.getValue();

    session.revoke();
    await this.sessionRepository.deleteBySessionToken(sessionToken);

    // Session revoked successfully

    this.logger.log({
      message: 'Session revoked successfully and cache invalidated',
      sessionId: session.id.getValue(),
      userId,
    });
  }

  async revokeUserSessions(userId: string, scope: 'local' | 'global' = 'global'): Promise<void> {
    this.logger.debug({ message: 'Revoking user sessions', userId, scope });

    if (scope === 'global') {
      // Revoke all sessions for the user
      await this.sessionRepository.deleteByUserId(userId);

      // All sessions revoked successfully

      this.logger.log({ message: 'All user sessions revoked and cache invalidated', userId });
    } else {
      // For local scope, we would need the current session token to revoke just that one
      // This will be handled in the logout endpoint
      this.logger.debug({ message: 'Local session revocation handled at endpoint level', userId });
    }
  }

  async revokeUserSessionsExcept(userId: string, excludeSessionToken: string): Promise<void> {
    this.logger.debug({
      message: 'Revoking user sessions except current one',
      userId,
      excludeSessionToken: excludeSessionToken.substring(0, 10) + '...',
    });

    await this.sessionRepository.deleteByUserIdExcept(userId, excludeSessionToken);

    // All sessions except current revoked successfully

    this.logger.log({
      message: 'All user sessions revoked except current one and cache invalidated',
      userId,
    });
  }

  async revokeSessionByRefreshToken(refreshToken: string): Promise<void> {
    this.logger.debug({ message: 'Revoking session by refresh token' });

    const session = await this.sessionRepository.findByRefreshToken(refreshToken);
    if (!session) {
      this.logger.warn({ message: 'Session not found for refresh token revocation' });

      return;
    }

    const userId = session.userId.getValue();

    session.revoke();
    await this.sessionRepository.deleteByRefreshToken(refreshToken);

    // Session revoked by refresh token successfully

    this.logger.log({
      message: 'Session revoked by refresh token and cache invalidated',
      sessionId: session.id.getValue(),
      userId,
    });
  }

  async refreshSession(
    userId: string,
    oldRefreshToken: string,
    newSessionToken: string,
    newRefreshToken: string,
  ): Promise<Session> {
    this.logger.debug({ message: 'Refreshing session' });

    // Get the current session
    const session = await this.validateRefreshToken(oldRefreshToken);

    // Revoke the old session
    await this.revokeSessionByRefreshToken(oldRefreshToken);

    // Create a new session with the same user and client info
    const newSession = await this.createSession(
      session.userId.getValue(),
      newSessionToken,
      newRefreshToken,
      session.userAgent,
      session.ipAddress,
    );

    this.logger.log({
      message: 'Session refreshed successfully',
      oldSessionId: session.id.getValue(),
      newSessionId: newSession.id.getValue(),
      userId: session.userId.getValue(),
    });

    return newSession;
  }

  /**
   * Enforces maximum active sessions per user
   * Business Rule: Limit concurrent sessions for security
   * Special case: -1 means unlimited sessions allowed
   */
  private async enforceMaxActiveSessions(userId: string): Promise<void> {
    const sessionConfig = this.businessConfigService.getSessionConfig();

    // -1 means unlimited sessions
    if (sessionConfig.maxActiveSessions === -1) {
      this.logger.debug({
        message: 'Unlimited sessions allowed for user',
        userId,
      });

      return;
    }

    const activeSessions = await this.sessionRepository.findByUserId(userId);

    if (activeSessions.length >= sessionConfig.maxActiveSessions) {
      this.logger.warn({
        message: 'Maximum active sessions reached, removing oldest session',
        userId,
        maxSessions: sessionConfig.maxActiveSessions,
        currentSessions: activeSessions.length,
      });

      // Remove the oldest session
      const oldestSession = activeSessions.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      )[0];

      if (oldestSession) {
        await this.revokeSession(oldestSession.sessionToken);
        // Note: revokeSession already invalidates the cache
        this.logger.log({
          message: 'Oldest session revoked to make room for new session',
          userId,
          revokedSessionId: oldestSession.id.getValue(),
          revokedSessionToken: oldestSession.sessionToken.substring(0, 10) + '...',
        });
      }
    }
  }

  /**
   * Checks if a session has expired due to inactivity
   * Business Rule: Sessions expire after configured inactivity timeout
   * Special case: -1 means sessions never expire due to inactivity
   */
  async isSessionExpired(session: Session): Promise<boolean> {
    const sessionConfig = this.businessConfigService.getSessionConfig();

    // -1 means sessions never expire
    if (sessionConfig.inactivityTimeoutMinutes === -1) {
      return false;
    }

    const lastActivity = session.updatedAt || session.createdAt;
    const inactivityMinutes = (Date.now() - lastActivity.getTime()) / (1000 * 60);

    return inactivityMinutes > sessionConfig.inactivityTimeoutMinutes;
  }

  /**
   * Extends session if activity-based extension is enabled
   * Business Rule: Active sessions can be automatically extended
   */
  async extendSessionIfActive(sessionId: string): Promise<void> {
    const sessionConfig = this.businessConfigService.getSessionConfig();

    if (sessionConfig.extendOnActivity) {
      const session = await this.sessionRepository.findById(sessionId);
      if (session && !(await this.isSessionExpired(session))) {
        session.updateActivity();
        await this.sessionRepository.update(session);

        this.logger.debug({
          message: 'Session extended due to activity',
          sessionId,
          userId: session.userId.getValue(),
        });
      }
    }
  }
}
