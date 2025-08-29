import { Transform } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';

/**
 * Custom decorator that trims strings and validates length constraints
 * Verifies that both original and trimmed strings meet length requirements
 * Supports both single strings and arrays of strings
 */
export function TrimAndValidateLength(options: { min?: number; max?: number } = {}) {
  return Transform(({ value }) => {
    // Handle arrays of strings
    if (Array.isArray(value)) {
      return value.map(item => {
        if (typeof item !== 'string') {
          return item;
        }

        const originalValue = item;
        const trimmedValue = item.trim();

        // Check length constraints if provided
        if (options.min !== undefined || options.max !== undefined) {
          const originalLength = originalValue.length;
          const trimmedLength = trimmedValue.length;

          // Check original length constraints
          if (options.min !== undefined && originalLength < options.min) {
            throw new BadRequestException(
              `Array string must be at least ${options.min} characters long (before trimming)`,
            );
          }
          if (options.max !== undefined && originalLength > options.max) {
            throw new BadRequestException(
              `Array string must be at most ${options.max} characters long (before trimming)`,
            );
          }

          // Check trimmed length constraints
          if (options.min !== undefined && trimmedLength < options.min) {
            throw new BadRequestException(
              `Array string must be at least ${options.min} characters long (after trimming)`,
            );
          }
          if (options.max !== undefined && trimmedLength > options.max) {
            throw new BadRequestException(
              `Array string must be at most ${options.max} characters long (after trimming)`,
            );
          }
        }

        return trimmedValue;
      });
    }

    // Handle single strings
    if (typeof value !== 'string') {
      return value;
    }

    const originalValue = value;
    const trimmedValue = value.trim();

    // Check length constraints if provided
    if (options.min !== undefined || options.max !== undefined) {
      const originalLength = originalValue.length;
      const trimmedLength = trimmedValue.length;

      // Check original length constraints
      if (options.min !== undefined && originalLength < options.min) {
        throw new BadRequestException(
          `String must be at least ${options.min} characters long (before trimming)`,
        );
      }
      if (options.max !== undefined && originalLength > options.max) {
        throw new BadRequestException(
          `String must be at most ${options.max} characters long (before trimming)`,
        );
      }

      // Check trimmed length constraints
      if (options.min !== undefined && trimmedLength < options.min) {
        throw new BadRequestException(
          `String must be at least ${options.min} characters long (after trimming)`,
        );
      }
      if (options.max !== undefined && trimmedLength > options.max) {
        throw new BadRequestException(
          `String must be at most ${options.max} characters long (after trimming)`,
        );
      }
    }

    return trimmedValue;
  });
}

/**
 * Simple trim decorator for strings without length validation concerns
 * Supports both single strings and arrays of strings
 */
export function TrimString() {
  return Transform(({ value }) => {
    // Handle arrays of strings
    if (Array.isArray(value)) {
      return value.map(item => {
        if (typeof item !== 'string') {
          return item;
        }

        return item.trim();
      });
    }

    // Handle single strings
    if (typeof value !== 'string') {
      return value;
    }

    return value.trim();
  });
}
