import { Injectable } from '@nestjs/common';
import { File } from '@core/entities/file.entity';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { RolesEnum } from '@shared/constants/enums';

export interface IFileAccessRules {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  reason?: string;
}

export interface IUserContext {
  sub: string;
  companyId?: string;
  role?: RolesEnum;
  roles?: RolesEnum[];
}

@Injectable()
export class FileAccessControlService {
  /**
   * Determines if a user can read a file based on business rules
   *
   * Rules:
   * 1. Root users can read any file
   * 2. File owners can always read their files
   * 3. Anyone can read public files
   * 4. Non-public files are only readable by owners
   */
  canReadFile(file: File, user: IJwtPayload | IUserContext | null): IFileAccessRules {
    // Anonymous users can only read public files
    if (!user) {
      return {
        canRead: file.isPublic,
        canWrite: false,
        canDelete: false,
        reason: file.isPublic ? 'Public file access' : 'Authentication required for private files',
      };
    }

    // Root users can read any file
    if (this.isRootUser(user)) {
      return {
        canRead: true,
        canWrite: !this.isRootReadonlyUser(user),
        canDelete: !this.isRootReadonlyUser(user),
        reason: 'Root user access',
      };
    }

    // File owners can always read their files
    if (this.isFileOwner(file, user)) {
      return {
        canRead: true,
        canWrite: true,
        canDelete: true,
        reason: 'File owner access',
      };
    }

    // Public files - check if it's a common area file
    if (file.isPublic) {
      const userCompanyId = this.getUserCompanyId(user);
      const fileCompanyId = this.extractCompanyIdFromPath(file.path);

      // For common area files, check if user is from the same company
      if (this.isCommonAreaFile(file)) {
        if (userCompanyId && fileCompanyId && userCompanyId === fileCompanyId) {
          // Users from same company can read/write common area files
          return {
            canRead: true,
            canWrite: true,
            canDelete: false, // Only file owner can delete
            reason: 'Company common area access',
          };
        } else {
          return {
            canRead: false,
            canWrite: false,
            canDelete: false,
            reason: 'Different company',
          };
        }
      }

      // Regular public files (non-common area) - only for accessible from same company
      if (userCompanyId && fileCompanyId && userCompanyId === fileCompanyId) {
        return {
          canRead: true,
          canWrite: false,
          canDelete: false,
          reason: 'Public file access',
        };
      }
    }

    // Private files are only accessible to owners
    return {
      canRead: false,
      canWrite: false,
      canDelete: false,
      reason: 'Private file - access denied',
    };
  }

  /**
   * Determines if a user can modify a file (write operations)
   *
   * Rules:
   * 1. Root users can modify any file
   * 2. File owners can modify their files
   * 3. No one else can modify files
   */
  canModifyFile(file: File, user: IJwtPayload | IUserContext): IFileAccessRules {
    // Root users can modify any file
    if (this.isRootUser(user)) {
      return {
        canRead: true,
        canWrite: !this.isRootReadonlyUser(user),
        canDelete: !this.isRootReadonlyUser(user),
        reason: 'Root user access',
      };
    }

    // File owners can modify their files
    if (this.isFileOwner(file, user)) {
      return {
        canRead: true,
        canWrite: true,
        canDelete: true,
        reason: 'File owner access',
      };
    }

    // No one else can modify files
    return {
      canRead: this.canReadFile(file, user).canRead,
      canWrite: false,
      canDelete: false,
      reason: 'Insufficient permissions to modify file',
    };
  }

  /**
   * Determines if a user can delete a file
   *
   * Rules:
   * 1. Root users can delete any file
   * 2. File owners can delete their files
   * 3. No one else can delete files
   */
  canDeleteFile(file: File, user: IJwtPayload | IUserContext): IFileAccessRules {
    return this.canModifyFile(file, user);
  }

  /**
   * Determines if a user can change file visibility (public/private)
   *
   * Rules:
   * 1. Root users can change visibility of any file
   * 2. File owners can change visibility of their files
   * 3. No one else can change visibility
   */
  canChangeVisibility(file: File, user: IJwtPayload | IUserContext): IFileAccessRules {
    return this.canModifyFile(file, user);
  }

  /**
   * Filters a list of files based on what the user can read
   */
  filterReadableFiles(files: File[], user: IJwtPayload | IUserContext | null): File[] {
    return files.filter(file => this.canReadFile(file, user).canRead);
  }

  /**
   * Gets files that a user can read with tenant isolation
   * This method should be used with repository queries for efficiency
   */
  getReadableFilesCriteria(user: IJwtPayload | null): {
    includePublic: boolean;
    includeOwnedBy?: string;
    includeAll?: boolean;
  } {
    if (!user) {
      return { includePublic: true };
    }

    if (this.isRootUser(user)) {
      return { includePublic: true, includeAll: true };
    }

    return {
      includePublic: true,
      includeOwnedBy: user.sub,
    };
  }

  /**
   * Validates file access and throws error if access denied
   */
  validateFileAccess(
    file: File,
    user: IJwtPayload | IUserContext | null,
    operation: 'read' | 'write' | 'delete',
  ): void {
    let access: IFileAccessRules;

    switch (operation) {
      case 'read':
        access = this.canReadFile(file, user);
        if (!access.canRead) {
          throw new Error(`Access denied: ${access.reason}`);
        }
        break;
      case 'write':
        if (!user) throw new Error('Authentication required for write operations');
        access = this.canModifyFile(file, user);
        if (!access.canWrite) {
          throw new Error(`Access denied: ${access.reason}`);
        }
        break;
      case 'delete':
        if (!user) throw new Error('Authentication required for delete operations');
        access = this.canDeleteFile(file, user);
        if (!access.canDelete) {
          throw new Error(`Access denied: ${access.reason}`);
        }
        break;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private isRootUser(user: IJwtPayload | IUserContext): boolean {
    return (
      user.roles?.includes(RolesEnum.ROOT) || user.roles?.includes(RolesEnum.ROOT_READONLY) || false
    );
  }

  private isRootReadonlyUser(user: IJwtPayload | IUserContext): boolean {
    return user.roles?.includes(RolesEnum.ROOT_READONLY) || false;
  }

  private isFileOwner(file: File, user: IJwtPayload | IUserContext): boolean {
    return file.userId === user.sub;
  }

  /**
   * Checks if a file is in a common area (shared company folder)
   */
  private isCommonAreaFile(file: File): boolean {
    // Check if the file path indicates it's in a common area
    // Format: company-uuid/common/folder-name/...
    return file.path.includes('/common/');
  }

  /**
   * Extracts company ID from hierarchical file path
   */
  private extractCompanyIdFromPath(path: string): string | null {
    // Format: company-uuid/users/user-uuid/... or company-uuid/common/folder/...
    const parts = path.split('/');

    return parts.length > 0 ? parts[0] : null;
  }

  /**
   * Gets the company ID from user context
   */
  private getUserCompanyId(user: IJwtPayload | IUserContext): string | null {
    if ('companyId' in user && user.companyId) {
      return user.companyId;
    }
    // For IJwtPayload, company ID might be in a different field
    if ('company_id' in user && (user as { company_id: string }).company_id) {
      return (user as { company_id: string }).company_id;
    }

    return null;
  }
}
