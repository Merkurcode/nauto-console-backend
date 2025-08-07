import { Injectable } from '@nestjs/common';

/**
 * Domain service responsible for extracting context information from HTTP requests
 * Business Rule: Provides a standardized way to extract client information for audit trails
 */
@Injectable()
export class RequestContextService {
  /**
   * Extracts the client's IP address from various request sources
   * Business Rule: Prioritize direct IP over proxied addresses
   * @param request - HTTP request object
   * @returns string representing client IP address
   */
  extractIpAddress(request: {
    ip?: string;
    connection?: { remoteAddress?: string; socket?: { remoteAddress?: string } };
    socket?: { remoteAddress?: string };
  }): string {
    return (
      request.ip ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      (request.connection?.socket ? request.connection.socket.remoteAddress : null) ||
      'unknown'
    );
  }

  /**
   * Extracts the user agent from request headers
   * Business Rule: User agent is used for session identification and audit trails
   * @param headers - HTTP headers object
   * @returns string representing user agent
   */
  extractUserAgent(headers: Record<string, string>): string {
    return headers['user-agent'] || 'unknown';
  }

  /**
   * Extracts both IP and user agent for audit context
   * Business Rule: Combine all audit-relevant request information
   * @param request - HTTP request object with headers
   * @returns Object containing IP and user agent
   */
  extractAuditContext(request: {
    headers: Record<string, string>;
    ip?: string;
    connection?: { remoteAddress?: string; socket?: { remoteAddress?: string } };
    socket?: { remoteAddress?: string };
  }): {
    ipAddress: string;
    userAgent: string;
  } {
    return {
      ipAddress: this.extractIpAddress(request),
      userAgent: this.extractUserAgent(request.headers),
    };
  }

  /**
   * Validates if IP address is valid for business operations
   * Business Rule: Block operations from invalid or suspicious IP addresses
   * @param ipAddress - IP address to validate
   * @returns boolean indicating if IP is valid
   */
  isValidIpAddress(ipAddress: string): boolean {
    // Business rule: Don't allow operations from unknown or localhost in production
    if (ipAddress === 'unknown' || ipAddress === '127.0.0.1' || ipAddress === '::1') {
      return process.env.NODE_ENV === 'development';
    }

    return true;
  }
}
