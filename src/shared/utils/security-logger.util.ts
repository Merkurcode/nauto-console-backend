/**
 * Security utility for safe logging of sensitive data
 * Prevents exposure of tokens, passwords, and other sensitive information in logs
 */
export class SecurityLogger {
  /**
   * Masks sensitive data by showing only first few characters
   * @param data The sensitive data to mask
   * @param visibleChars Number of characters to show (default: 6)
   * @returns Masked string like "abc123***"
   */
  static maskSensitiveData(data: string | null | undefined, visibleChars: number = 6): string {
    if (!data) return 'none';
    if (data.length <= visibleChars) return '***';
    return data.substring(0, visibleChars) + '***';
  }

  /**
   * Masks authentication tokens
   * @param token Token to mask
   * @returns Masked token showing first 8 characters
   */
  static maskToken(token: string | null | undefined): string {
    return this.maskSensitiveData(token, 8);
  }

  /**
   * Masks session tokens
   * @param sessionToken Session token to mask
   * @returns Masked session token
   */
  static maskSessionToken(sessionToken: string | null | undefined): string {
    return this.maskSensitiveData(sessionToken, 6);
  }

  /**
   * Masks email verification codes
   * @param code Verification code to mask
   * @returns Masked code
   */
  static maskVerificationCode(code: string | null | undefined): string {
    if (!code) return 'none';
    return '***' + code.slice(-2); // Show last 2 digits only
  }

  /**
   * Masks API keys and secrets
   * @param apiKey API key to mask
   * @returns Masked API key
   */
  static maskApiKey(apiKey: string | null | undefined): string {
    return this.maskSensitiveData(apiKey, 4);
  }

  /**
   * Masks URLs containing sensitive tokens
   * @param url URL that may contain sensitive parameters
   * @returns URL with sensitive parts masked
   */
  static maskSensitiveUrl(url: string | null | undefined): string {
    if (!url) return 'none';
    
    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;
      
      // Mask common sensitive parameters
      const sensitiveParams = ['token', 'code', 'key', 'secret', 'password', 'auth'];
      
      sensitiveParams.forEach(param => {
        if (params.has(param)) {
          const value = params.get(param);
          if (value) {
            params.set(param, this.maskSensitiveData(value, 4));
          }
        }
      });
      
      return urlObj.toString();
    } catch {
      // If URL parsing fails, mask the entire thing after domain
      const domainMatch = url.match(/^(https?:\/\/[^\/]+)/);
      if (domainMatch) {
        return domainMatch[1] + '/***';
      }
      return '***';
    }
  }

  /**
   * Creates a safe log object with masked sensitive data
   * @param logData Original log data object
   * @returns Log data with sensitive fields masked
   */
  static createSafeLogData(logData: Record<string, any>): Record<string, any> {
    const safeData = { ...logData };
    
    // List of fields that should always be masked
    const sensitiveFields = [
      'password', 'token', 'sessionToken', 'refreshToken', 'accessToken',
      'secret', 'key', 'apiKey', 'code', 'verificationCode', 'resetToken',
      'authToken', 'bearerToken', 'resetLink', 'verificationLink'
    ];
    
    sensitiveFields.forEach(field => {
      if (safeData[field]) {
        safeData[field] = this.maskSensitiveData(safeData[field]);
      }
    });
    
    // Special handling for URLs
    if (safeData.resetLink || safeData.verificationLink) {
      if (safeData.resetLink) {
        safeData.resetLink = this.maskSensitiveUrl(safeData.resetLink);
      }
      if (safeData.verificationLink) {
        safeData.verificationLink = this.maskSensitiveUrl(safeData.verificationLink);
      }
    }
    
    return safeData;
  }
}