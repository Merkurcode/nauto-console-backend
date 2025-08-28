import { Transform } from 'class-transformer';

/**
 * Decorator to normalize email addresses
 *
 * This decorator:
 * - Trims whitespace from both ends
 * - Converts to lowercase
 * - Ensures consistent email formatting
 *
 * @example
 * ```typescript
 * class LoginDto {
 *   @NormalizeEmail()
 *   @IsEmail()
 *   email: string;
 * }
 * ```
 */
export const NormalizeEmail = () =>
  Transform(({ value }: { value: string }) => {
    if (typeof value !== 'string') {
      return value;
    }

    return value.trim().toLowerCase();
  });
