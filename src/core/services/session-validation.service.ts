import { Injectable } from '@nestjs/common';
import { InvalidInputException } from '@core/exceptions/domain-exceptions';
import { LogoutScope } from '@shared/constants/enums';

/**
 * Domain service responsible for session-related business rules and validation
 */
@Injectable()
export class SessionValidationService {
  /**
   * Validates session token requirements for different logout scopes
   * Business Rule: Local logout requires a valid session token, global logout doesn't
   */
  validateLogoutRequirements(sessionToken: string | undefined, scope: LogoutScope): void {
    if (scope === LogoutScope.LOCAL && !sessionToken) {
      throw new InvalidInputException(
        'Session token not found in JWT. Local logout requires a valid session token.',
      );
    }
  }

  /**
   * Extracts and validates session token from JWT payload
   * Business Rule: Session token should be present in jti claim for authenticated users
   */
  extractSessionToken(jwtPayload: { jti?: string }): string | undefined {
    return jwtPayload.jti;
  }

  /**
   * Validates session token format and structure
   * Business Rule: Session tokens must be non-empty strings
   */
  validateSessionTokenFormat(sessionToken: string): boolean {
    return typeof sessionToken === 'string' && sessionToken.length > 0;
  }
}
