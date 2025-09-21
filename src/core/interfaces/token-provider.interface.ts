import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { User } from '@core/entities/user.entity';

/**
 * Token provider interface for authentication services
 *
 * This interface abstracts token generation functionality to maintain Clean Architecture.
 * Application layer commands should depend on this abstraction, not on concrete implementations.
 */
export interface ITokenProvider {
  /**
   * Build JWT payload with user information
   * @param user - The user entity
   * @param permissions - Array of user permissions
   * @param sessionToken - Optional session token to include in JWT
   * @returns JWT payload object
   */
  buildPayload(user: User, permissions: string[], sessionToken?: string): IJwtPayload;

  /**
   * Generate an access token from payload
   * @param payload - JWT payload
   * @returns JWT access token string
   */
  generateAccessToken(payload: IJwtPayload): string;

  /**
   * Generate a refresh token and store it
   * @param userId - User ID to generate refresh token for
   * @returns Refresh token string
   */
  generateRefreshToken(userId: string): Promise<string>;

  /**
   * Generate both access and refresh tokens for a user
   * @param user - The user entity
   * @param permissions - Array of user permissions
   * @param sessionToken - Optional session token
   * @returns Object containing both tokens and session token
   */
  generateTokens(
    user: User,
    permissions: string[],
    sessionToken?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    sessionToken: string;
  }>;
}
