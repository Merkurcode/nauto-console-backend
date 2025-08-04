import { Injectable, Inject } from '@nestjs/common';
import { Session } from '@core/entities/session.entity';
import { UserId } from '@core/value-objects/user-id.vo';
import { ISessionRepository } from '@core/repositories/session.repository.interface';
import { InvalidSessionException } from '@core/exceptions/domain-exceptions';
import { SESSION_REPOSITORY, LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';

@Injectable()
export class SessionService {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository,
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
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

    const session = await this.sessionRepository.findBySessionToken(sessionToken);
    if (!session) {
      this.logger.warn({ message: 'Session token not found' });
      throw new InvalidSessionException('Session not found');
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

    const session = await this.sessionRepository.findByRefreshToken(refreshToken);
    if (!session) {
      this.logger.warn({ message: 'Refresh token not found' });
      throw new InvalidSessionException('Invalid refresh token');
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
    this.logger.debug({ message: 'Revoking session', sessionToken });

    const session = await this.sessionRepository.findBySessionToken(sessionToken);
    if (!session) {
      this.logger.warn({ message: 'Session not found for revocation', sessionToken });

      return;
    }

    session.revoke();
    await this.sessionRepository.deleteBySessionToken(sessionToken);

    this.logger.log({
      message: 'Session revoked successfully',
      sessionId: session.id.getValue(),
      userId: session.userId.getValue(),
    });
  }

  async revokeUserSessions(userId: string, scope: 'local' | 'global' = 'global'): Promise<void> {
    this.logger.debug({ message: 'Revoking user sessions', userId, scope });

    if (scope === 'global') {
      // Revoke all sessions for the user
      await this.sessionRepository.deleteByUserId(userId);
      this.logger.log({ message: 'All user sessions revoked', userId });
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

    this.logger.log({
      message: 'All user sessions revoked except current one',
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

    session.revoke();
    await this.sessionRepository.deleteByRefreshToken(refreshToken);

    this.logger.log({
      message: 'Session revoked by refresh token',
      sessionId: session.id.getValue(),
      userId: session.userId.getValue(),
    });
  }

  async refreshSession(
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
}
