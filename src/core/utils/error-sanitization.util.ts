/**
 * Security utility for sanitizing error information to prevent information disclosure
 *
 * **Purpose**: Centralized error sanitization to prevent sensitive information
 * from being leaked through error messages, stack traces, and logs.
 *
 * **Security Considerations**:
 * - Remove file system paths that could reveal server structure
 * - Sanitize database connection strings and credentials
 * - Remove internal server details and configurations
 * - Prevent disclosure of user data in error messages
 * - Sanitize stack traces for production environments
 *
 * **Features**:
 * - Environment-aware sanitization (stricter in production)
 * - Configurable sanitization levels
 * - Safe fallbacks for unknown error types
 * - Performance-optimized for high-throughput logging
 */

export interface ISanitizedError {
  message: string;
  stack?: string;
  type?: string;
  code?: string;
  sanitized: boolean;
}

export enum SanitizationLevel {
  NONE = 'none', // No sanitization (development only)
  BASIC = 'basic', // Basic sanitization (staging)
  STRICT = 'strict', // Full sanitization (production)
}

export class ErrorSanitizationUtil {
  private static readonly SENSITIVE_PATTERNS = [
    // File system paths (more specific and performance-safe)
    /[A-Za-z]:\\(?:[\w-]+\\){2,}[\w.-]+/g, // Windows paths (3+ segments)
    /\/(?:[\w-]+\/){3,}[\w.-]+/g, // Unix paths (4+ segments to avoid false positives)
    /\/home\/[\w-]+\/[\w\/-]+/g, // Home directory paths
    /\/var\/[\w-]+\/[\w\/-]+/g, // System paths
    /\/usr\/[\w-]+\/[\w\/-]+/g, // User paths
    /\/opt\/[\w-]+\/[\w\/-]+/g, // Optional software paths
    /\/tmp\/[\w\/-]+/g, // Temp paths

    // Database and connection strings (more comprehensive)
    /(?:mongodb|postgresql|mysql|redis):\/\/[^@\s]+@[^\s\/]+/g, // Connection URIs
    /jdbc:[\w:\/]+/g, // JDBC URLs
    /Server=[\w.-]+;Database=[\w]+/gi, // SQL Server connection strings

    // Environment variables and secrets (stricter patterns)
    /[A-Z_]{4,}=[^\s]{8,}/g, // Long ENV vars (4+ chars = 8+ value)
    /(?:api[_-]?key|secret|token|password)['":\s=]*[^\s'",;]{10,}/gi, // Credentials (10+ chars)
    /Bearer\s+[a-zA-Z0-9+\/=]{20,}/g, // Bearer tokens
    /Basic\s+[a-zA-Z0-9+\/=]{10,}/g, // Basic auth tokens

    // Network information (more precise)
    /(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):\d{1,5}/g, // Valid IP:PORT
    /localhost:\d{1,5}/g, // localhost:port
    /127\.0\.0\.1:\d{1,5}/g, // Loopback with port
    /0\.0\.0\.0:\d{1,5}/g, // All interfaces with port

    // User data patterns (more specific)
    /user[_-]?id['":\s=]*[\w\d-]{10,}/gi, // User IDs (10+ chars)
    /\b[\w.-]+@[\w.-]+\.[a-z]{2,}\b/gi, // Email addresses
    /\b\d{4}-\d{4}-\d{4}-\d{4}\b/g, // Credit card patterns
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN patterns

    // Internal server details
    /node_modules[\\\/][\w\\\/.-]{10,}/g, // Node modules paths (10+ chars)
    /at\s+[\w.]+\s+\([^)]{20,}\)/g, // Long stack trace locations
    /Error:\s+[^\n]{50,}/g, // Long error messages

    // System information
    /pid:\s*\d+/gi, // Process IDs
    /port:\s*\d+/gi, // Port numbers in logs
    /version:\s*[\d.]+/gi, // Version numbers
  ];

  private static readonly REPLACEMENT_TEXT = '[REDACTED]';
  private static readonly MAX_MESSAGE_LENGTH = 200;
  private static readonly MAX_STACK_LENGTH = 1000;

  /**
   * Sanitize error information based on environment and level
   */
  static sanitizeError(
    error: unknown,
    level: SanitizationLevel = SanitizationLevel.STRICT,
    _context?: string,
  ): ISanitizedError {
    if (level === SanitizationLevel.NONE) {
      // No sanitization - development only
      return this.convertErrorWithoutSanitization(error);
    }

    try {
      const baseError = this.convertToBaseError(error);

      return {
        message: this.sanitizeMessage(baseError.message, level),
        stack:
          level === SanitizationLevel.STRICT
            ? undefined
            : this.sanitizeStack(baseError.stack, level),
        type: this.sanitizeErrorType(baseError.type),
        code: this.sanitizeErrorCode(baseError.code),
        sanitized: true,
      };
    } catch {
      // Fallback if sanitization itself fails
      return {
        message: 'An error occurred (details sanitized)',
        type: 'UnknownError',
        sanitized: true,
      };
    }
  }

  /**
   * Sanitize just the error message (lightweight version with ReDoS protection)
   */
  static sanitizeMessage(
    message: string,
    level: SanitizationLevel = SanitizationLevel.STRICT,
  ): string {
    if (!message || typeof message !== 'string') {
      return 'Invalid error message';
    }

    let sanitized = message;

    // Security: Prevent ReDoS attacks - truncate BEFORE regex processing
    if (sanitized.length > this.MAX_MESSAGE_LENGTH) {
      sanitized = sanitized.substring(0, this.MAX_MESSAGE_LENGTH) + '...';
    }

    if (level === SanitizationLevel.BASIC || level === SanitizationLevel.STRICT) {
      // Security: Apply sanitization patterns with timeout protection
      try {
        // Use timeout wrapper to prevent ReDoS attacks
        sanitized = this.applySanitizationWithTimeout(sanitized, 50); // 50ms timeout
      } catch {
        // If sanitization times out (potential ReDoS), return generic message
        return 'Error occurred (details sanitized due to security)';
      }

      // Additional strict sanitization (with safe patterns)
      if (level === SanitizationLevel.STRICT) {
        // Use character-by-character validation instead of complex regex
        sanitized = this.sanitizeInternalDetails(sanitized);

        // Generic error messages for common cases (safe string operations)
        if (
          sanitized.toLowerCase().includes('enoent') ||
          sanitized.toLowerCase().includes('permission denied')
        ) {
          sanitized = 'File system access error';
        }
        if (
          sanitized.toLowerCase().includes('econnrefused') ||
          sanitized.toLowerCase().includes('timeout')
        ) {
          sanitized = 'External service unavailable';
        }
        if (
          sanitized.toLowerCase().includes('duplicate') &&
          sanitized.toLowerCase().includes('key')
        ) {
          sanitized = 'Data constraint violation';
        }
      }
    }

    // Final cleanup (safe operations only)
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized || 'Error occurred';
  }

  /**
   * Apply sanitization patterns with ReDoS protection (character-by-character approach)
   */
  private static applySanitizationWithTimeout(text: string, maxTimeMs: number): string {
    const startTime = Date.now();

    // Security: Use character-by-character pattern matching instead of regex
    const sanitized = this.applySanitizationSafely(text);

    // Check overall timeout
    if (Date.now() - startTime > maxTimeMs) {
      throw new Error('Sanitization timeout - potential ReDoS attack');
    }

    return sanitized;
  }

  /**
   * Apply sanitization using safe string operations instead of regex
   */
  private static applySanitizationSafely(text: string): string {
    let result = text;

    // Security: Replace sensitive patterns using safe string operations
    result = this.sanitizeFilePaths(result);
    result = this.sanitizeConnectionStrings(result);
    result = this.sanitizeCredentials(result);
    result = this.sanitizeNetworkInfo(result);
    result = this.sanitizeUserData(result);
    result = this.sanitizeSystemInfo(result);

    return result;
  }

  /**
   * Sanitize file paths using safe string operations
   */
  private static sanitizeFilePaths(text: string): string {
    let result = text;

    // Windows paths (safe replacement)
    const windowsPathIndicators = ['C:\\', 'D:\\', 'E:\\', 'F:\\'];
    for (const indicator of windowsPathIndicators) {
      if (result.includes(indicator)) {
        const segments = result.split(indicator);
        for (let i = 1; i < segments.length; i++) {
          const pathEnd = segments[i].indexOf(' ');
          if (pathEnd > 10) {
            // Only replace long paths
            segments[i] = this.REPLACEMENT_TEXT + segments[i].substring(pathEnd);
          }
        }
        result = segments.join(indicator);
      }
    }

    // Unix paths (safe replacement)
    const unixPathIndicators = ['/home/', '/var/', '/usr/', '/opt/', '/tmp/'];
    for (const indicator of unixPathIndicators) {
      if (result.includes(indicator)) {
        const parts = result.split(indicator);
        for (let i = 1; i < parts.length; i++) {
          const spaceIndex = parts[i].indexOf(' ');
          const pathLength = spaceIndex === -1 ? parts[i].length : spaceIndex;
          if (pathLength > 10) {
            // Only replace long paths
            const replacement =
              spaceIndex === -1
                ? this.REPLACEMENT_TEXT
                : this.REPLACEMENT_TEXT + parts[i].substring(spaceIndex);
            parts[i] = replacement;
          }
        }
        result = parts.join(indicator);
      }
    }

    return result;
  }

  /**
   * Sanitize connection strings using safe string operations
   */
  private static sanitizeConnectionStrings(text: string): string {
    let result = text;

    const connectionPrefixes = ['mongodb://', 'postgresql://', 'mysql://', 'redis://', 'jdbc:'];
    for (const prefix of connectionPrefixes) {
      if (result.includes(prefix)) {
        const parts = result.split(prefix);
        for (let i = 1; i < parts.length; i++) {
          // Find the end of the connection string
          const spaceIndex = parts[i].indexOf(' ');
          const endIndex =
            spaceIndex === -1 ? Math.min(parts[i].length, 100) : Math.min(spaceIndex, 100);

          if (endIndex > 5) {
            const replacement =
              this.REPLACEMENT_TEXT + (spaceIndex === -1 ? '' : parts[i].substring(spaceIndex));
            parts[i] = replacement;
          }
        }
        result = parts.join(prefix);
      }
    }

    return result;
  }

  /**
   * Sanitize credentials using safe string operations
   */
  private static sanitizeCredentials(text: string): string {
    let result = text;

    const credentialTerms = [
      'api_key',
      'apikey',
      'secret',
      'token',
      'password',
      'Bearer ',
      'Basic ',
    ];

    for (const term of credentialTerms) {
      let searchIndex = 0;
      while (true) {
        const index = result.toLowerCase().indexOf(term.toLowerCase(), searchIndex);
        if (index === -1) break;

        // Find the credential value (after = or : or space)
        let valueStart = index + term.length;
        while (
          valueStart < result.length &&
          (result[valueStart] === '=' ||
            result[valueStart] === ':' ||
            result[valueStart] === ' ' ||
            result[valueStart] === '"' ||
            result[valueStart] === "'")
        ) {
          valueStart++;
        }

        if (valueStart < result.length) {
          // Find the end of the credential
          let valueEnd = valueStart;
          while (
            valueEnd < result.length &&
            result[valueEnd] !== ' ' &&
            result[valueEnd] !== '\n' &&
            result[valueEnd] !== '\r' &&
            result[valueEnd] !== '"' &&
            result[valueEnd] !== "'" &&
            result[valueEnd] !== ',' &&
            result[valueEnd] !== ';'
          ) {
            valueEnd++;
          }

          if (valueEnd - valueStart > 5) {
            // Only replace long values
            result =
              result.substring(0, valueStart) + this.REPLACEMENT_TEXT + result.substring(valueEnd);
          }
        }

        searchIndex = index + term.length;
      }
    }

    return result;
  }

  /**
   * Sanitize network information using safe string operations
   */
  private static sanitizeNetworkInfo(text: string): string {
    const result = text;

    // Simple IP:PORT pattern detection
    const words = result.split(' ');
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (this.looksLikeIpPort(word)) {
        words[i] = this.REPLACEMENT_TEXT;
      }
    }

    return words.join(' ');
  }

  /**
   * Check if a word looks like an IP:PORT combination
   */
  private static looksLikeIpPort(text: string): boolean {
    if (text.length < 9 || text.length > 21) return false; // Basic length check

    const colonIndex = text.lastIndexOf(':');
    if (colonIndex === -1) return false;

    const ip = text.substring(0, colonIndex);
    const port = text.substring(colonIndex + 1);

    // Check if port is numeric and in valid range
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) return false;

    // Check if IP looks valid (simple check)
    const ipParts = ip.split('.');
    if (ipParts.length !== 4) return false;

    for (const part of ipParts) {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0 || num > 255) return false;
    }

    return true;
  }

  /**
   * Sanitize user data using safe string operations
   */
  private static sanitizeUserData(text: string): string {
    const result = text;

    // Email pattern detection (simple)
    const words = result.split(' ');
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (this.looksLikeEmail(word)) {
        const atIndex = word.indexOf('@');
        const localPart = word.substring(0, atIndex);
        const domainPart = word.substring(atIndex);
        words[i] = localPart.substring(0, 2) + '***' + domainPart;
      }
    }

    return words.join(' ');
  }

  /**
   * Check if text looks like an email address
   */
  private static looksLikeEmail(text: string): boolean {
    if (text.length < 5 || text.length > 254) return false;

    const atIndex = text.indexOf('@');
    if (atIndex <= 0 || atIndex >= text.length - 1) return false;

    const dotIndex = text.lastIndexOf('.');
    if (dotIndex <= atIndex || dotIndex >= text.length - 1) return false;

    return true;
  }

  /**
   * Sanitize system information using safe string operations
   */
  private static sanitizeSystemInfo(text: string): string {
    let result = text;

    const systemTerms = ['pid:', 'port:', 'version:', 'node_modules'];

    for (const term of systemTerms) {
      if (result.toLowerCase().includes(term.toLowerCase())) {
        let searchIndex = 0;
        while (true) {
          const index = result.toLowerCase().indexOf(term.toLowerCase(), searchIndex);
          if (index === -1) break;

          let endIndex = result.indexOf(' ', index);
          if (endIndex === -1) endIndex = result.length;

          result = result.substring(0, index) + this.REPLACEMENT_TEXT + result.substring(endIndex);
          searchIndex = index + this.REPLACEMENT_TEXT.length;
        }
      }
    }

    return result;
  }

  /**
   * Sanitize internal details using safe character-by-character approach
   */
  private static sanitizeInternalDetails(text: string): string {
    let result = '';
    let internalTokenBuffer = '';
    let numberBuffer = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Track potential internal identifiers (starts with uppercase, has underscores/numbers)
      if (/[A-Z]/.test(char)) {
        if (internalTokenBuffer.length === 0) {
          internalTokenBuffer = char;
        } else {
          internalTokenBuffer += char;
        }
      } else if (internalTokenBuffer.length > 0 && /[a-zA-Z0-9_]/.test(char)) {
        internalTokenBuffer += char;
      } else {
        // End of potential internal token
        if (internalTokenBuffer.length > 10 && /[A-Z].*[_0-9]/.test(internalTokenBuffer)) {
          result += '[INTERNAL]';
        } else {
          result += internalTokenBuffer;
        }
        internalTokenBuffer = '';
        result += char;
      }

      // Track long numbers
      if (/\d/.test(char)) {
        numberBuffer += char;
      } else {
        if (numberBuffer.length >= 10) {
          result = result.slice(0, result.length - numberBuffer.length) + '[NUMBER]' + char;
        } else {
          result += char;
        }
        numberBuffer = '';
      }
    }

    // Handle buffers at end of string
    if (internalTokenBuffer.length > 10 && /[A-Z].*[_0-9]/.test(internalTokenBuffer)) {
      result += '[INTERNAL]';
    } else {
      result += internalTokenBuffer;
    }

    if (numberBuffer.length >= 10) {
      result = result.slice(0, result.length - numberBuffer.length) + '[NUMBER]';
    }

    return result;
  }

  /**
   * Sanitize stack trace
   */
  private static sanitizeStack(
    stack?: string,
    _level: SanitizationLevel = SanitizationLevel.BASIC,
  ): string | undefined {
    if (!stack || typeof stack !== 'string') {
      return undefined;
    }

    let sanitized = stack;

    // Truncate if too long
    if (sanitized.length > this.MAX_STACK_LENGTH) {
      sanitized = sanitized.substring(0, this.MAX_STACK_LENGTH) + '\n... [truncated]';
    }

    // Apply sanitization patterns
    for (const pattern of this.SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, this.REPLACEMENT_TEXT);
    }

    // Remove absolute paths from stack traces
    sanitized = sanitized.replace(
      /\s+at\s+.*[\\\/]node_modules[\\\/].*/g,
      '\n    at [node_modules]',
    );
    sanitized = sanitized.replace(/\s+at\s+.*[\\\/]src[\\\/].*/g, '\n    at [application]');

    return sanitized;
  }

  /**
   * Sanitize error type
   */
  private static sanitizeErrorType(type?: string): string | undefined {
    if (!type || typeof type !== 'string') {
      return undefined;
    }

    // Only allow known safe error types
    const safeTypes = [
      'Error',
      'TypeError',
      'ReferenceError',
      'SyntaxError',
      'RangeError',
      'ValidationError',
      'AuthenticationError',
      'AuthorizationError',
      'NotFoundError',
      'ConflictError',
      'TimeoutError',
    ];

    return safeTypes.includes(type) ? type : 'ApplicationError';
  }

  /**
   * Sanitize error code
   */
  private static sanitizeErrorCode(code?: string): string | undefined {
    if (!code || typeof code !== 'string') {
      return undefined;
    }

    // Only allow alphanumeric error codes
    if (/^[A-Z0-9_]{1,20}$/i.test(code)) {
      return code;
    }

    return undefined;
  }

  /**
   * Convert unknown error to base error structure
   */
  private static convertToBaseError(error: unknown): {
    message: string;
    stack?: string;
    type?: string;
    code?: string;
  } {
    if (error instanceof Error) {
      return {
        message: error.message || 'Unknown error',
        stack: error.stack,
        type: error.constructor.name,
        code: (error as any).code,
      };
    }

    if (typeof error === 'string') {
      return {
        message: error,
        type: 'StringError',
      };
    }

    if (typeof error === 'object' && error !== null) {
      const obj = error as any;

      return {
        message: obj.message || obj.toString?.() || 'Object error',
        stack: obj.stack,
        type: obj.constructor?.name || 'ObjectError',
        code: obj.code,
      };
    }

    return {
      message: String(error) || 'Unknown error occurred',
      type: 'UnknownError',
    };
  }

  /**
   * Convert error without sanitization (development only)
   */
  private static convertErrorWithoutSanitization(error: unknown): ISanitizedError {
    const baseError = this.convertToBaseError(error);

    return {
      message: baseError.message,
      stack: baseError.stack,
      type: baseError.type,
      code: baseError.code,
      sanitized: false,
    };
  }

  /**
   * Get appropriate sanitization level based on environment
   */
  static getSanitizationLevelFromEnv(nodeEnv?: string): SanitizationLevel {
    const env = (nodeEnv || process.env.NODE_ENV || 'production').toLowerCase();

    switch (env) {
      case 'development':
      case 'dev':
      case 'local':
        return SanitizationLevel.NONE;
      case 'test':
      case 'testing':
      case 'staging':
        return SanitizationLevel.BASIC;
      case 'production':
      case 'prod':
      default:
        return SanitizationLevel.STRICT;
    }
  }

  /**
   * Create sanitized error for logging (convenience method)
   */
  static forLogging(error: unknown, _context?: string): { message: string; stack?: string } {
    const level = this.getSanitizationLevelFromEnv();
    const sanitized = this.sanitizeError(error, level, _context);

    return {
      message: sanitized.message,
      stack: sanitized.stack,
    };
  }
}
