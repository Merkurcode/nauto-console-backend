import { Request } from 'express';

export class CommonUtils {
  /**
   * Extract real client IP considering proxies
   */
  public static getClientIpAddress(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;

    return (
      forwardedIp?.split(',')[0]?.trim() ||
      (request.headers['x-real-ip'] as string) ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }
}
