import { Injectable } from '@nestjs/common';
import { ForbiddenActionException } from '@core/exceptions/domain-exceptions';
import { ConfigService } from '@nestjs/config';

/**
 * Domain service responsible for user deletion business policies
 */
@Injectable()
export class UserDeletionPolicyService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Determines if user deletion is allowed based on business rules
   * Business Rule: User deletion via API is only allowed in development environment
   */
  canDeleteUser(): boolean {
    const nodeEnv = this.configService.get<string>('env', 'production');

    return nodeEnv === 'development';
  }

  /**
   * Enforces user deletion policy and throws appropriate business exception
   * Business Rule: Prevent accidental user deletion in production environments
   */
  enforceUserDeletionPolicy(): void {
    if (!this.canDeleteUser()) {
      throw new ForbiddenActionException(
        'User deletion via API is not allowed in the current environment. ' +
          'This operation is restricted to development environments only for safety reasons.',
      );
    }
  }

  /**
   * Gets the current environment for audit/logging purposes
   */
  getCurrentEnvironment(): string {
    return this.configService.get<string>('env', 'production');
  }

  /**
   * Checks if the current environment allows destructive operations
   * Business Rule: Destructive operations should be limited to safe environments
   */
  isDestructiveOperationAllowed(): boolean {
    const nodeEnv = this.getCurrentEnvironment();

    return nodeEnv === 'development' || nodeEnv === 'test';
  }
}
