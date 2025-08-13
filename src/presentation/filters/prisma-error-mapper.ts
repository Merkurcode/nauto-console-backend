import { HttpStatus } from '@nestjs/common';

interface IMappedError {
  message: string;
  status: number;
  error: string;
}

/**
 * Maps Prisma errors to user-friendly HTTP responses
 * SECURITY: Prevents exposure of internal database details
 */
export class PrismaErrorMapper {
  /**
   * Map foreign key constraint errors to specific messages
   */
  private static mapForeignKeyError(errorMessage: string): IMappedError {
    const constraintPatterns = [
      {
        pattern: 'companyId_fkey',
        message: 'The specified company does not exist',
        error: 'Company Not Found',
      },
      {
        pattern: 'userId_fkey',
        message: 'The specified user does not exist',
        error: 'User Not Found',
      },
      {
        pattern: 'aiPersonaId_fkey',
        message: 'The specified AI persona does not exist',
        error: 'AI Persona Not Found',
      },
      {
        pattern: 'roleId_fkey',
        message: 'The specified role does not exist',
        error: 'Role Not Found',
      },
      {
        pattern: 'permissionId_fkey',
        message: 'The specified permission does not exist',
        error: 'Permission Not Found',
      },
      {
        pattern: 'createdBy_fkey',
        message: 'The creator user does not exist',
        error: 'Creator Not Found',
      },
      {
        pattern: 'updatedBy_fkey',
        message: 'The updater user does not exist',
        error: 'Updater Not Found',
      },
    ];

    for (const { pattern, message, error } of constraintPatterns) {
      if (errorMessage.includes(pattern)) {
        return { message, status: HttpStatus.NOT_FOUND, error };
      }
    }

    return {
      message: 'Referenced entity does not exist',
      status: HttpStatus.NOT_FOUND,
      error: 'Referenced Entity Not Found',
    };
  }

  /**
   * Map unique constraint errors to specific messages
   */
  private static mapUniqueConstraintError(errorMessage: string): IMappedError {
    const uniquePatterns = [
      {
        pattern: 'keyName',
        message: 'An AI persona with this key name already exists',
        error: 'Duplicate Key Name',
      },
      {
        pattern: 'email',
        message: 'An account with this email already exists',
        error: 'Email Already Exists',
      },
      {
        pattern: 'name',
        message: 'A record with this name already exists',
        error: 'Name Already Exists',
      },
      { pattern: 'sessionToken', message: 'Session conflict occurred', error: 'Session Conflict' },
      { pattern: 'refreshToken', message: 'Token conflict occurred', error: 'Token Conflict' },
    ];

    for (const { pattern, message, error } of uniquePatterns) {
      if (errorMessage.includes(pattern)) {
        return { message, status: HttpStatus.CONFLICT, error };
      }
    }

    return {
      message: 'This record already exists',
      status: HttpStatus.CONFLICT,
      error: 'Duplicate Entry',
    };
  }

  /**
   * Check if error is a Prisma database error
   */
  static isPrismaError(errorMessage: string): boolean {
    const prismaIndicators = [
      'Foreign key constraint violated',
      'Unique constraint failed',
      'Invalid `this.client',
      'Prisma Client',
      'invocation in',
      'PrismaClientKnownRequestError',
      'PrismaClientValidationError',
    ];

    return prismaIndicators.some(indicator => errorMessage.includes(indicator));
  }

  /**
   * Map Prisma error to user-friendly response
   */
  static mapError(errorMessage: string): IMappedError {
    if (errorMessage.includes('Foreign key constraint violated')) {
      return this.mapForeignKeyError(errorMessage);
    }

    if (errorMessage.includes('Unique constraint failed')) {
      return this.mapUniqueConstraintError(errorMessage);
    }

    // Generic Prisma error fallback
    return {
      message: 'Invalid data provided',
      status: HttpStatus.BAD_REQUEST,
      error: 'Bad Request',
    };
  }
}
