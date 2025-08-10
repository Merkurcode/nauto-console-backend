import { parse as parseUrl } from 'url';
import * as path from 'path';

/**
 * Secure path verification utility to prevent bypass attacks
 *
 * Common bypass attempts this protects against:
 * - Path traversal: /api/../admin
 * - URL encoding: /api%2Fhealth
 * - Double encoding: %252F
 * - Case variations: /API/HEALTH
 * - Null bytes: /api/health%00.json
 * - Extra slashes: //api///health
 * - Query params: /api/health?bypass=true
 * - Fragments: /api/health#bypass
 * - Unicode normalization attacks
 */
export class PathSecurityUtil {
  /**
   * Normalize and sanitize a request path for secure comparison
   */
  static normalizePath(requestPath: string): string {
    if (!requestPath) {
      return '/';
    }

    try {
      // Parse URL to remove query params and fragments
      const parsed = parseUrl(requestPath);
      let cleanPath = parsed.pathname || '/';

      // Decode URL encoding (but prevent double decoding attacks)
      cleanPath = this.safeUrlDecode(cleanPath);

      // Remove null bytes and control characters
      cleanPath = cleanPath.replace(/\x00/g, '').replace(/[\x01-\x1F\x7F]/g, '');

      // Normalize Unicode characters (prevent homograph attacks)
      cleanPath = cleanPath.normalize('NFC');

      // Convert to lowercase for case-insensitive comparison
      cleanPath = cleanPath.toLowerCase();

      // Resolve path traversal attempts (../, ./, etc)
      cleanPath = path.posix.normalize(cleanPath);

      // Remove duplicate slashes
      cleanPath = cleanPath.replace(/\/+/g, '/');

      // Ensure path starts with /
      if (!cleanPath.startsWith('/')) {
        cleanPath = '/' + cleanPath;
      }

      // Remove trailing slash unless it's the root path
      if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
        cleanPath = cleanPath.slice(0, -1);
      }

      return cleanPath;
    } catch (error) {
      // If any error occurs during normalization, treat as potentially malicious
      console.error('Path normalization error:', error);

      return '';
    }
  }

  /**
   * Safely decode URL encoding, preventing double-encoding attacks
   */
  private static safeUrlDecode(str: string): string {
    try {
      // Check for double encoding patterns (e.g., %252F = %2F encoded)
      if (/%25[0-9a-fA-F]{2}/.test(str)) {
        // Double encoding detected - don't decode
        return str;
      }

      // First check if string contains % followed by hex chars
      if (!/%[0-9a-fA-F]{2}/.test(str)) {
        return str; // No encoding detected
      }

      // Decode once
      const decoded = decodeURIComponent(str);

      return decoded;
    } catch {
      // Invalid encoding - return original
      return str;
    }
  }

  /**
   * Check if a path matches any pattern in the list (secure version)
   * NOW WITH STRICT MATCHING - Only exact matches are allowed
   */
  static matchesPattern(requestPath: string, patterns: string[]): boolean {
    const normalizedRequest = this.normalizePath(requestPath);

    // Empty or invalid path should not match anything
    if (!normalizedRequest) {
      return false;
    }

    return patterns.some(pattern => {
      const normalizedPattern = this.normalizePath(pattern);

      // STRICT: Only exact match
      return normalizedRequest === normalizedPattern;
    });
  }

  /**
   * Validate that a path doesn't contain suspicious patterns
   */
  static isSuspiciousPath(requestPath: string): boolean {
    const suspicious = [
      // Path traversal
      '../',
      '..\\',
      '..%2f',
      '..%5c',
      '%2e%2e%2f',
      '%2e%2e%5c',

      // Null bytes
      '\x00',
      '%00',

      // Alternative data streams (Windows)
      '::$',

      // Unicode direction override characters
      '\u202E', // Right-to-left override
      '\u200F', // Right-to-left mark
      '\u200E', // Left-to-right mark
      '\u202D', // Left-to-right override

      // Common injection patterns
      '<script',
      'javascript:',
      'data:text/html',

      // SQL injection patterns
      'union select',
      'or 1=1',
      '; drop',

      // Command injection patterns
      '$(',
      '`',
      '&&',
      '||',
      '|',
      ';',
      '\n',
      '\r',
    ];

    const lowerPath = requestPath.toLowerCase();

    return suspicious.some(pattern => lowerPath.includes(pattern));
  }

  /**
   * Extract the API prefix from a path safely
   */
  static getApiPrefix(requestPath: string): string {
    const normalized = this.normalizePath(requestPath);
    const parts = normalized.split('/').filter(Boolean);

    if (parts.length >= 2 && parts[0] === 'api') {
      return `/${parts[0]}/${parts[1]}`;
    }

    if (parts.length >= 1) {
      return `/${parts[0]}`;
    }

    return '/';
  }

  /**
   * Check if path is trying to access internal routes
   */
  static isInternalPath(requestPath: string): boolean {
    const internalPrefixes = [
      '/_',
      '/.git',
      '/.env',
      '/.well-known/security',
      '/admin-internal',
      '/debug',
      '/trace',
    ];

    const normalized = this.normalizePath(requestPath);

    return internalPrefixes.some(prefix => normalized.startsWith(this.normalizePath(prefix)));
  }
}
