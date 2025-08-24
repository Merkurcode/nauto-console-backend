import { Transform } from 'class-transformer';

/**
 * Trim whitespace from string properties.
 * Automatically removes leading and trailing whitespace from string values.
 *
 * @example
 * ```typescript
 * export class MyDto {
 *   @Trim()
 *   @IsString()
 *   name: string;
 * }
 * ```
 */
export function Trim() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }

    return value;
  });
}

/**
 * Trim whitespace from string array properties.
 * Removes leading and trailing whitespace from each string in an array.
 *
 * @example
 * ```typescript
 * export class MyDto {
 *   @TrimArray()
 *   @IsArray()
 *   @IsString({ each: true })
 *   tags: string[];
 * }
 * ```
 */
export function TrimArray() {
  return Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.map(item => {
        if (typeof item === 'string') {
          return item.trim();
        }

        return item;
      });
    }

    return value;
  });
}

/**
 * Transform empty strings to null after trimming.
 * Useful for optional fields where empty string should be treated as null.
 *
 * @example
 * ```typescript
 * export class MyDto {
 *   @TrimToNull()
 *   @IsOptional()
 *   @IsString()
 *   description?: string | null;
 * }
 * ```
 */
export function TrimToNull() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();

      return trimmed === '' ? null : trimmed;
    }

    return value;
  });
}
