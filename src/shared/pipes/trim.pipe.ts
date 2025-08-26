import { PipeTransform, Injectable } from '@nestjs/common';

/**
 * Pipe to automatically trim whitespace from route parameters and query parameters.
 * Can be applied to individual parameters or globally.
 *
 * @example
 * ```typescript
 * // Apply to individual parameter
 * async getFile(@Param('fileId', TrimPipe) fileId: string) {
 *   // fileId will be trimmed
 * }
 *
 * // Apply to query parameter
 * async getFiles(@Query('search', TrimPipe) search: string) {
 *   // search will be trimmed
 * }
 * ```
 */
@Injectable()
export class TrimPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string') {
      return value;
    }

    return value.trim();
  }
}

/**
 * Pipe to trim and convert empty strings to null.
 * Useful for optional parameters where empty string should be treated as null.
 *
 * @example
 * ```typescript
 * async getFiles(@Query('search', TrimToNullPipe) search: string | null) {
 *   // Empty string becomes null, other strings are trimmed
 * }
 * ```
 */
@Injectable()
export class TrimToNullPipe implements PipeTransform<string, string | null> {
  transform(value: string): string | null {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();

    return trimmed === '' ? null : trimmed;
  }
}

/**
 * Pipe specifically for file IDs that trims and validates basic format.
 * Ensures file IDs don't contain dangerous characters.
 *
 * @example
 * ```typescript
 * async getFile(@Param('fileId', FileIdPipe) fileId: string) {
 *   // fileId will be trimmed and basic validation applied
 * }
 * ```
 */
@Injectable()
export class FileIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();

    // Basic validation - file IDs should be UUIDs or similar safe strings
    // Remove any potentially dangerous characters
    return trimmed.replace(/[^a-zA-Z0-9\-_]/g, '');
  }
}
