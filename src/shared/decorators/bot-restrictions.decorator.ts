import { SetMetadata } from '@nestjs/common';

/**
 * Metadata keys for BOT access control
 */
export const BOT_ONLY_KEY = 'bot_only';
export const NO_BOTS_KEY = 'no_bots';

/**
 * Decorator to restrict endpoint access to BOT users only
 *
 * @example
 * ```typescript
 * @Post('bulk-import')
 * @BotOnly()
 * async bulkImport(@Body() data: BulkImportDto) {
 *   // Only BOT users can access this endpoint
 * }
 * ```
 */
export const BotOnly = () => SetMetadata(BOT_ONLY_KEY, true);

/**
 * Decorator to prevent BOT users from accessing an endpoint
 *
 * @example
 * ```typescript
 * @Post('change-password')
 * @NoBots()
 * async changePassword(@Body() changePasswordDto: ChangePasswordDto) {
 *   // BOT users cannot access this endpoint
 * }
 * ```
 */
export const NoBots = () => SetMetadata(NO_BOTS_KEY, true);
