import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Safe characters for S3/MinIO object keys according to AWS documentation
 * https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html
 * Updated to allow spaces
 */
const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9!\-_.*'() ]+$/;
const UNSAFE_CHARACTERS_REGEX = /[\\{}\^%`\]\["~<>#|&$@=;/:+,?]/g;

@ValidatorConstraint({ name: 'SafeFilename', async: false })
export class SafeFilenameConstraint implements ValidatorConstraintInterface {
  validate(filename: string, _args: ValidationArguments) {
    if (!filename || typeof filename !== 'string') {
      return false;
    }

    // Check length (S3 limit is 1024 bytes)
    if (Buffer.byteLength(filename, 'utf8') > 1024) {
      return false;
    }

    // Check for safe characters only
    return SAFE_FILENAME_REGEX.test(filename);
  }

  defaultMessage(args: ValidationArguments) {
    const filename = args.value;
    if (!filename) {
      return 'Filename is required';
    }

    if (Buffer.byteLength(filename, 'utf8') > 1024) {
      return 'Filename is too long (max 1024 bytes)';
    }

    const unsafeChars = filename.match(UNSAFE_CHARACTERS_REGEX);
    if (unsafeChars) {
      const uniqueChars = [...new Set(unsafeChars)].join(', ');

      return `Filename contains unsafe characters: ${uniqueChars}. Only alphanumeric, spaces, and !-_.*'() are allowed`;
    }

    return 'Filename contains invalid characters';
  }
}

/**
 * Decorator to validate safe filenames for S3/MinIO storage
 */
export function IsSafeFilename(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: SafeFilenameConstraint,
    });
  };
}

/**
 * Sanitizes a filename to make it safe for S3/MinIO storage
 * Replaces unsafe characters with safe alternatives
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return '';

  // Replace unsafe characters with dashes (spaces are now allowed)
  let sanitized = filename.replace(/[\\{}\^%`\]\["~<>#|&$@=;/:+,?]/g, '-');

  // Remove consecutive dashes/underscores
  sanitized = sanitized.replace(/[-_]{2,}/g, '_');

  // Remove leading/trailing dashes/underscores
  sanitized = sanitized.replace(/^[-_]+|[-_]+$/g, '');

  // Ensure filename is not empty after sanitization
  if (!sanitized) {
    sanitized = 'file_' + Date.now();
  }

  // Truncate if too long (leave room for extensions)
  if (Buffer.byteLength(sanitized, 'utf8') > 900) {
    // Keep extension if present
    const lastDot = sanitized.lastIndexOf('.');
    if (lastDot > 0) {
      const name = sanitized.substring(0, lastDot);
      const ext = sanitized.substring(lastDot);
      sanitized = name.substring(0, 800) + ext;
    } else {
      sanitized = sanitized.substring(0, 900);
    }
  }

  return sanitized;
}

/**
 * Checks if a filename is safe for S3/MinIO storage
 */
export function isSafeFilename(filename: string): boolean {
  if (!filename || typeof filename !== 'string') {
    return false;
  }

  if (Buffer.byteLength(filename, 'utf8') > 1024) {
    return false;
  }

  return SAFE_FILENAME_REGEX.test(filename);
}
