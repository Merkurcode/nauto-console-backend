/**
 * Simple storage path builders based on FIXED structure
 * No complex validation, no flexibility - just FACTS
 */

export class StoragePaths {
  /**
   * User space path: company-uuid/users/user-uuid/userPath
   */
  static forUser(companyId: string, userId: string, userPath: string = ''): string {
    const cleanPath = userPath.trim().replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes

    return cleanPath ? `${companyId}/users/${userId}/${cleanPath}` : `${companyId}/users/${userId}`;
  }

  /**
   * Products area path: company-uuid/common/products/userPath
   */
  static forProducts(companyId: string, userPath: string = ''): string {
    const cleanPath = userPath.trim().replace(/^\/+|\/+$/g, '');

    return cleanPath ? `${companyId}/common/products/${cleanPath}` : `${companyId}/common/products`;
  }

  /**
   * Marketing area path: company-uuid/common/marketing/userPath
   */
  static forMarketing(companyId: string, userPath: string = ''): string {
    const cleanPath = userPath.trim().replace(/^\/+|\/+$/g, '');

    return cleanPath
      ? `${companyId}/common/marketing/${cleanPath}`
      : `${companyId}/common/marketing`;
  }

  /**
   * Create object key by combining path and filename
   */
  static createObjectKey(storagePath: string, filename: string): string {
    const cleanFilename = filename.trim();

    return storagePath ? `${storagePath}/${cleanFilename}` : cleanFilename;
  }

  /**
   * Basic security validation - only critical checks
   */
  static validateUserPath(userPath: string): void {
    if (!userPath || typeof userPath !== 'string') {
      throw new Error('Path is required');
    }

    // Only critical security checks
    if (userPath.includes('../') || userPath.includes('..\\')) {
      throw new Error('Path traversal not allowed');
    }

    if (userPath.includes('\0')) {
      throw new Error('Null bytes not allowed');
    }

    if (userPath.startsWith('/') || userPath.startsWith('\\')) {
      throw new Error('Absolute paths not allowed');
    }

    if (/^[a-zA-Z]:/.test(userPath)) {
      throw new Error('Drive letters not allowed');
    }
  }
}
