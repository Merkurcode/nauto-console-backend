/**
 * Session Security Utility
 * Simple utilities for session management
 */

export class SessionSecurityUtil {
  /**
   * Sanitize session token for logging (security-safe)
   */
  static sanitizeTokenForLogging(token: string): string {
    if (!token || token.length < 16) {
      return '[INVALID_TOKEN]';
    }

    // Show first 8 and last 4 characters with *** in between
    return `${token.substring(0, 8)}***${token.substring(token.length - 4)}`;
  }
}
