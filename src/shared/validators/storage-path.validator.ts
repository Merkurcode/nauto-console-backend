import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

/**
 * Simple path validator that only checks for critical security issues
 * Allows users to name their folders and files however they want
 */
export function IsValidStoragePath(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidStoragePath',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (typeof value !== 'string') {
            return false;
          }

          // Allow empty paths (root level)
          if (value === '' || value === undefined) {
            return true;
          }

          // Check for path traversal attempts
          if (value.includes('../') || value.includes('..\\')) {
            return false;
          }

          // Check for absolute paths
          if (value.startsWith('/') || value.startsWith('\\')) {
            return false;
          }

          // Check for drive letters (Windows)
          if (/^[a-zA-Z]:/.test(value)) {
            return false;
          }

          // Check for null bytes
          if (value.includes('\0')) {
            return false;
          }

          return true;
        },
        defaultMessage(args: ValidationArguments) {
          const value = args.value as string;

          if (value.includes('../') || value.includes('..\\')) {
            return 'Path cannot contain parent directory references (..)';
          }

          if (value.startsWith('/') || value.startsWith('\\')) {
            return 'Path cannot be absolute (starting with / or \\)';
          }

          if (/^[a-zA-Z]:/.test(value)) {
            return 'Path cannot contain drive letters';
          }

          if (value.includes('\0')) {
            return 'Path cannot contain null bytes';
          }

          return 'Invalid storage path';
        },
      },
    });
  };
}

/**
 * Simple filename validator - minimal restrictions
 */
export function IsValidFileName(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidFileName',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (typeof value !== 'string') {
            return false;
          }

          const filename = value.trim();

          // Check if empty
          if (filename.length === 0) {
            return false;
          }

          // Check for path separators (filename should not contain paths)
          if (filename.includes('/') || filename.includes('\\')) {
            return false;
          }

          // Check for null bytes
          if (filename.includes('\0')) {
            return false;
          }

          // Check reasonable length (255 is typical filesystem limit)
          if (filename.length > 255) {
            return false;
          }

          return true;
        },
        defaultMessage(args: ValidationArguments) {
          const value = args.value as string;

          if (!value || value.trim().length === 0) {
            return 'Filename cannot be empty';
          }

          if (value.includes('/') || value.includes('\\')) {
            return 'Filename cannot contain path separators (/ or \\)';
          }

          if (value.includes('\0')) {
            return 'Filename cannot contain null bytes';
          }

          if (value.length > 255) {
            return 'Filename is too long (max 255 characters)';
          }

          return 'Invalid filename';
        },
      },
    });
  };
}

/**
 * Validates that the directory depth doesn't exceed the maximum allowed levels
 * Prevents deeply nested directory attacks and performance issues
 * @param maxDepth Maximum directory depth allowed (default: 100)
 */
export function HasValidDirectoryDepth(
  maxDepth: number = 100,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'hasValidDirectoryDepth',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [maxDepth],
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (typeof value !== 'string') {
            return false;
          }

          // Allow empty paths (root level)
          if (value === '' || value === undefined) {
            return true;
          }

          const [maxAllowedDepth] = args.constraints;

          // Calculate path depth by counting directory separators
          // Remove leading/trailing slashes and split by separators
          const cleanPath = value.replace(/^\/+|\/+$/g, '');
          if (cleanPath === '') {
            return true; // Empty path after cleaning = root level
          }

          // Count directory levels
          const pathSegments = cleanPath.split(/[\/\\]+/).filter(segment => segment.length > 0);
          const currentDepth = pathSegments.length;

          return currentDepth <= maxAllowedDepth;
        },
        defaultMessage(args: ValidationArguments) {
          const [maxAllowedDepth] = args.constraints;
          const value = args.value as string;

          if (value) {
            const cleanPath = value.replace(/^\/+|\/+$/g, '');
            const pathSegments = cleanPath.split(/[\/\\]+/).filter(segment => segment.length > 0);
            const currentDepth = pathSegments.length;

            return `Directory depth of ${currentDepth} levels exceeds maximum allowed depth of ${maxAllowedDepth} levels`;
          }

          return `Directory depth exceeds maximum allowed depth of ${maxAllowedDepth} levels`;
        },
      },
    });
  };
}
