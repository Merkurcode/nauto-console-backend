import { AggregateRoot } from '@core/events/domain-event.base';
import { UserId } from '@core/value-objects/user-id.vo';
import { StorageTiers } from './storage-tiers.entity';
import {
  UserStorageConfigCreatedEvent,
  UserStorageConfigUpdatedEvent,
} from '@core/events/user-storage-config.events';

export interface IAllowedFileConfig {
  [extension: string]: string[]; // extension -> array of mime types
}

export interface IUserStorageConfigCreateOptions {
  maxSimultaneousFilesLimit?: number; // From environment config
}

export class UserStorageConfig extends AggregateRoot {
  private readonly _id: string;
  private readonly _userId: UserId;
  private _storageTierId: string;
  private _storageTier: StorageTiers | null;
  private _allowedFileConfig: IAllowedFileConfig;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(
    id: string,
    userId: UserId,
    storageTierId: string,
    allowedFileConfig: IAllowedFileConfig,
    createdAt: Date,
    updatedAt: Date,
    storageTier?: StorageTiers | null,
  ) {
    super();
    this._id = id;
    this._userId = userId;
    this._storageTierId = storageTierId;
    this._storageTier = storageTier || null;
    this._allowedFileConfig = allowedFileConfig;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;

    this.validateInvariants();
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get userId(): UserId {
    return this._userId;
  }

  get storageTierId(): string {
    return this._storageTierId;
  }

  get storageTier(): StorageTiers | null {
    return this._storageTier;
  }

  // Delegated getters from storage tier
  get maxStorageBytes(): bigint {
    if (!this._storageTier) {
      throw new Error('Storage tier not loaded');
    }

    return this._storageTier.maxStorageBytes.getValue();
  }

  get maxSimultaneousFiles(): number {
    if (!this._storageTier) {
      throw new Error('Storage tier not loaded');
    }

    return this._storageTier.maxSimultaneousFiles.getValue();
  }

  get allowedFileConfig(): IAllowedFileConfig {
    return { ...this._allowedFileConfig }; // Return copy to prevent mutation
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Business methods
  setStorageTier(storageTier: StorageTiers): void {
    this._storageTier = storageTier;
  }

  updateStorageTier(newStorageTierId: string): void {
    if (this._storageTierId === newStorageTierId) {
      return; // No change needed
    }

    const oldValue = this._storageTierId;
    this._storageTierId = newStorageTierId;
    this._storageTier = null; // Clear cached tier, will be loaded again
    this._updatedAt = new Date();

    this.addDomainEvent(
      new UserStorageConfigUpdatedEvent(this._userId, 'storageTierId', oldValue, newStorageTierId),
    );
  }

  updateAllowedFileConfig(newAllowedFileConfig: IAllowedFileConfig): void {
    this.validateFileConfig(newAllowedFileConfig);

    const oldConfig = JSON.stringify(this._allowedFileConfig);
    this._allowedFileConfig = { ...newAllowedFileConfig };
    this._updatedAt = new Date();

    this.addDomainEvent(
      new UserStorageConfigUpdatedEvent(
        this._userId,
        'allowedFileConfig',
        oldConfig,
        JSON.stringify(newAllowedFileConfig),
      ),
    );
  }

  // Query methods
  isFileTypeAllowed(fileExtension: string): boolean {
    const extension = fileExtension.toLowerCase().replace('.', '');

    return extension in this._allowedFileConfig;
  }

  isMimeTypeAllowed(mimeType: string, fileExtension: string): boolean {
    const extension = fileExtension.toLowerCase().replace('.', '');
    const allowedMimeTypes = this._allowedFileConfig[extension];

    if (!allowedMimeTypes) {
      return false;
    }

    return allowedMimeTypes.includes(mimeType.toLowerCase());
  }

  canUploadFiles(fileCount: number): boolean {
    if (!this._storageTier) {
      throw new Error('Storage tier not loaded');
    }

    return this._storageTier.canUploadFiles(fileCount);
  }

  getMaxStorageInMB(): number {
    if (!this._storageTier) {
      throw new Error('Storage tier not loaded');
    }

    return this._storageTier.maxStorageBytes.toMegabytes();
  }

  getMaxStorageInBytes(): bigint {
    if (!this._storageTier) {
      throw new Error('Storage tier not loaded');
    }

    return this._storageTier.maxStorageBytes.getValue();
  }

  getAllowedExtensions(): string[] {
    return Object.keys(this._allowedFileConfig);
  }

  getAllowedMimeTypes(): string[] {
    return Object.values(this._allowedFileConfig).flat();
  }

  getMimeTypesForExtension(extension: string): string[] {
    const ext = extension.toLowerCase().replace('.', '');

    return this._allowedFileConfig[ext] || [];
  }

  // Factory method
  static create(
    userId: UserId,
    storageTierId: string,
    allowedFileConfig: IAllowedFileConfig = UserStorageConfig.getDefaultFileConfig(),
  ): UserStorageConfig {
    const config = new UserStorageConfig(
      crypto.randomUUID(),
      userId,
      storageTierId,
      allowedFileConfig,
      new Date(),
      new Date(),
    );

    config.addDomainEvent(new UserStorageConfigCreatedEvent(userId, storageTierId));

    return config;
  }

  static getDefaultFileConfig(): IAllowedFileConfig {
    return {
      jpg: ['image/jpeg'],
      jpeg: ['image/jpeg'],
      png: ['image/png'],
      pdf: ['application/pdf'],
      doc: ['application/msword'],
      docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      xls: ['application/vnd.ms-excel'],
      xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      txt: ['text/plain'],
      csv: ['text/csv', 'application/csv'],
    };
  }

  // Invariants validation
  private validateInvariants(): void {
    this.validateFileConfig(this._allowedFileConfig);
  }

  private validateFileConfig(fileConfig: IAllowedFileConfig): void {
    if (Object.keys(fileConfig).length === 0) {
      throw new Error('At least one file type must be allowed');
    }

    // Validate that each extension has at least one mime type
    for (const [extension, mimeTypes] of Object.entries(fileConfig)) {
      if (!mimeTypes || mimeTypes.length === 0) {
        throw new Error(`Extension '${extension}' must have at least one mime type`);
      }
    }
  }

  // Serialization for persistence
  public toJSON(): Record<string, unknown> {
    return {
      id: this._id,
      userId: this._userId.getValue(),
      storageTierId: this._storageTierId,
      allowedFileConfig: this._allowedFileConfig,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
