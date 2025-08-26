import { ValueObject } from './base.vo';
import { InvalidHierarchicalPathException } from '@core/exceptions/storage-domain.exceptions';
import { PathType, CommonFolder } from '@shared/types/storage-areas.types';

export interface IHierarchicalPath {
  companyId: string;
  type: PathType;
  userId?: string; // Required for user paths, optional for common paths
  commonFolder?: CommonFolder; // Required for common paths
  subPath?: string; // Additional nested path
}

/**
 * Value Object for hierarchical paths in storage
 * Structure: {companyId}/{type}/{userId|commonFolder}/{subPath}
 *
 * Examples:
 * - User path: "company-123/users/user-456/documents/reports"
 * - Common path: "company-123/common/products/catalog"
 */
export class HierarchicalPath extends ValueObject<IHierarchicalPath> {
  constructor(value: IHierarchicalPath) {
    super(value);
    this.validate();
  }

  protected validate(): void {
    this.validateCompanyId(this.value.companyId);
    this.validatePathType(this.value);
    this.validateSubPath(this.value.subPath);
  }

  private validateCompanyId(companyId: string): void {
    if (!companyId || companyId.trim().length === 0) {
      throw new InvalidHierarchicalPathException('Company ID is required');
    }

    // UUID format validation (flexible for future changes)
    if (companyId.length < 3 || companyId.length > 64) {
      throw new InvalidHierarchicalPathException('Company ID must be between 3 and 64 characters');
    }

    // No dangerous characters
    if (/[<>:"|?*\\\/\0]/.test(companyId)) {
      throw new InvalidHierarchicalPathException('Company ID contains forbidden characters');
    }
  }

  private validatePathType(value: IHierarchicalPath): void {
    if (!Object.values(PathType).includes(value.type)) {
      throw new InvalidHierarchicalPathException(`Invalid path type: ${value.type}`);
    }

    if (value.type === PathType.USER) {
      this.validateUserPath(value);
    } else if (value.type === PathType.COMMON) {
      this.validateCommonPath(value);
    }
  }

  private validateUserPath(value: IHierarchicalPath): void {
    if (!value.userId || value.userId.trim().length === 0) {
      throw new InvalidHierarchicalPathException('User ID is required for user paths');
    }

    // UUID format validation
    if (value.userId.length < 3 || value.userId.length > 64) {
      throw new InvalidHierarchicalPathException('User ID must be between 3 and 64 characters');
    }

    // No dangerous characters
    if (/[<>:"|?*\\\/\0]/.test(value.userId)) {
      throw new InvalidHierarchicalPathException('User ID contains forbidden characters');
    }

    if (value.commonFolder) {
      throw new InvalidHierarchicalPathException(
        'Common folder should not be specified for user paths',
      );
    }
  }

  private validateCommonPath(value: IHierarchicalPath): void {
    if (!value.commonFolder) {
      throw new InvalidHierarchicalPathException('Common folder is required for common paths');
    }

    if (!Object.values(CommonFolder).includes(value.commonFolder)) {
      throw new InvalidHierarchicalPathException(`Invalid common folder: ${value.commonFolder}`);
    }

    if (value.userId) {
      throw new InvalidHierarchicalPathException(
        'User ID should not be specified for common paths',
      );
    }
  }

  private validateSubPath(subPath?: string): void {
    if (!subPath) return;

    // Normalize and validate
    const normalized = subPath.trim();
    if (normalized.length === 0) return;

    // No absolute paths or parent directory references - CRITICAL SECURITY
    if (normalized.startsWith('/') || normalized.includes('..')) {
      throw new InvalidHierarchicalPathException(
        'Sub-path cannot contain absolute paths or parent directory references',
      );
    }

    // No null bytes - CRITICAL SECURITY
    if (normalized.includes('\0')) {
      throw new InvalidHierarchicalPathException('Sub-path cannot contain null bytes');
    }

    // Reasonable length limit
    if (normalized.length > 1000) {
      throw new InvalidHierarchicalPathException('Sub-path is too long (max 1000 characters)');
    }

    // That's it! Users can name their folders however they want
    // The hierarchical structure already guarantees security by levels:
    // Level 1: bucket (nauto-console-dev)
    // Level 2: company-uuid
    // Level 3: users or common
    // Level 4+: user content or common folders
  }

  // Static factory methods
  public static createUserPath(
    companyId: string,
    userId: string,
    subPath?: string,
  ): HierarchicalPath {
    return new HierarchicalPath({
      companyId,
      type: PathType.USER,
      userId,
      subPath: subPath?.trim() || undefined,
    });
  }

  public static createCommonPath(
    companyId: string,
    commonFolder: CommonFolder,
    subPath?: string,
  ): HierarchicalPath {
    return new HierarchicalPath({
      companyId,
      type: PathType.COMMON,
      commonFolder,
      subPath: subPath?.trim() || undefined,
    });
  }

  public static fromPath(fullPath: string): HierarchicalPath {
    const parts = fullPath.split('/').filter(p => p.length > 0);

    if (parts.length < 2) {
      throw new InvalidHierarchicalPathException('Path must contain at least company ID and type');
    }

    const [companyId, type, ...rest] = parts;

    if (type === PathType.USER) {
      if (rest.length === 0) {
        throw new InvalidHierarchicalPathException('User paths must contain user ID');
      }
      const [userId, ...subPathParts] = rest;
      const subPath = subPathParts.length > 0 ? subPathParts.join('/') : undefined;

      return HierarchicalPath.createUserPath(companyId, userId, subPath);
    }

    if (type === PathType.COMMON) {
      if (rest.length === 0) {
        throw new InvalidHierarchicalPathException('Common paths must contain common folder');
      }
      const [commonFolder, ...subPathParts] = rest;

      if (!Object.values(CommonFolder).includes(commonFolder as CommonFolder)) {
        throw new InvalidHierarchicalPathException(`Invalid common folder: ${commonFolder}`);
      }

      const subPath = subPathParts.length > 0 ? subPathParts.join('/') : undefined;

      return HierarchicalPath.createCommonPath(companyId, commonFolder as CommonFolder, subPath);
    }

    throw new InvalidHierarchicalPathException(`Invalid path type: ${type}`);
  }

  // Getters
  public getCompanyId(): string {
    return this.value.companyId;
  }

  public getType(): PathType {
    return this.value.type;
  }

  public getUserId(): string | undefined {
    return this.value.userId;
  }

  public getCommonFolder(): CommonFolder | undefined {
    return this.value.commonFolder;
  }

  public getSubPath(): string | undefined {
    return this.value.subPath;
  }

  public isUserPath(): boolean {
    return this.value.type === PathType.USER;
  }

  public isCommonPath(): boolean {
    return this.value.type === PathType.COMMON;
  }

  // Path operations
  public toString(): string {
    const parts = [this.value.companyId, this.value.type];

    if (this.value.type === PathType.USER) {
      parts.push(this.value.userId!);
    } else {
      parts.push(this.value.commonFolder!);
    }

    if (this.value.subPath) {
      parts.push(this.value.subPath);
    }

    return parts.join('/');
  }

  public toObjectKeyPrefix(): string {
    // Same as toString for now, but separates concerns
    return this.toString();
  }

  public appendSubPath(additionalPath: string): HierarchicalPath {
    const newSubPath = this.value.subPath
      ? `${this.value.subPath}/${additionalPath}`
      : additionalPath;

    return new HierarchicalPath({
      ...this.value,
      subPath: newSubPath,
    });
  }

  public withSubPath(newSubPath: string): HierarchicalPath {
    return new HierarchicalPath({
      ...this.value,
      subPath: newSubPath,
    });
  }

  public getParentPath(): HierarchicalPath | null {
    if (!this.value.subPath) {
      return null; // Already at root level
    }

    const parts = this.value.subPath.split('/');
    if (parts.length <= 1) {
      // Remove subPath entirely
      return new HierarchicalPath({
        ...this.value,
        subPath: undefined,
      });
    }

    parts.pop();

    return new HierarchicalPath({
      ...this.value,
      subPath: parts.join('/'),
    });
  }

  // Access control helpers
  public canBeAccessedByUser(userId: string, companyId: string): boolean {
    // User can only access their own files within their company
    if (this.value.companyId !== companyId) {
      return false;
    }

    if (this.value.type === PathType.USER) {
      return this.value.userId === userId;
    }

    // Common paths accessible to any user in the company
    return this.value.type === PathType.COMMON;
  }

  // Migration helper for existing paths
  public static migrateFromLegacyPath(
    legacyPath: string,
    companyId: string,
    userId: string,
  ): HierarchicalPath {
    // Convert existing flat paths to hierarchical structure
    // Legacy path becomes subPath in user directory
    return HierarchicalPath.createUserPath(companyId, userId, legacyPath);
  }
}
