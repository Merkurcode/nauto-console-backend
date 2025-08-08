import { SetMetadata } from '@nestjs/common';

export const BOT_ACCESS_KEY = 'bot_access';

/**
 * Decorator to mark endpoints as accessible for BOT role with optimized performance
 * - Skips rate limiting for BOT users
 * - Enables high-throughput mode
 * - Maintains security for other roles
 */
export const BotAccess = () => SetMetadata(BOT_ACCESS_KEY, true);
