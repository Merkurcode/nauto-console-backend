import { AggregateRoot } from '@core/events/domain-event.base';
import { UserId } from '@core/value-objects/user-id.vo';
import { StorageTiers } from './storage-tiers.entity';
import {
  UserStorageConfigCreatedEvent,
  UserStorageConfigUpdatedEvent,
} from '@core/events/user-storage-config.events';
import { TargetAppsEnum } from '@shared/constants/target-apps.enum';

// ----ADD APPS----
export const StorageAppsMap = {
  whatsAppMaxBytes: TargetAppsEnum.WHATSAPP,
  // ...más pares
} as const satisfies Record<string, TargetAppsEnum>;
// ----------------

export const StorageAppsList = Object.keys(StorageAppsMap);

export type StorageAppKeys = keyof typeof StorageAppsMap;

// ----ADD APPS----
export const StorageAppsMapTags: Record<StorageAppKeys, string> = {
  whatsAppMaxBytes: '#whatsapp-compatible',
};
// ----------------

export const StorageInverseAppsMap: Partial<Record<TargetAppsEnum, StorageAppKeys>> =
  Object.entries(StorageAppsMap).reduce(
    (acc, [key, value]) => {
      acc[value] = key as StorageAppKeys;

      return acc;
    },
    {} as Partial<Record<TargetAppsEnum, StorageAppKeys>>,
  );

export const StorageAppsInverseList = Object.keys(StorageInverseAppsMap).map(
  key => key as TargetAppsEnum,
);

// New format with app-specific limits
export interface IAllowedFileConfig {
  [extension: string]: {
    mimes: string[];
    whatsAppMaxBytes?: number;
    // Future apps can be added here
  };
}

export const isValidFileSizeForStorageApp = (
  app: TargetAppsEnum,
  size: number,
  config: IAllowedFileConfig,
  fileExtension: string,
): { valid: boolean; appName: string } => {
  const key: StorageAppKeys = StorageInverseAppsMap[app];
  if (key) {
    const maxBytes: number = config[fileExtension][key];
    if (typeof maxBytes === 'number') {
      return { valid: size <= maxBytes, appName: app };
    }
  }

  return { valid: false, appName: TargetAppsEnum.NONE };
};

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
    const extensionConfig = this._allowedFileConfig[extension];

    if (!extensionConfig || !extensionConfig.mimes) {
      return false;
    }

    return extensionConfig.mimes.includes(mimeType.toLowerCase());
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
    const allMimeTypes: string[] = [];

    Object.values(this._allowedFileConfig).forEach(config => {
      if (config.mimes && Array.isArray(config.mimes)) {
        allMimeTypes.push(...config.mimes);
      }
    });

    return [...new Set(allMimeTypes)]; // Remove duplicates
  }

  getMimeTypesForExtension(extension: string): string[] {
    const ext = extension.toLowerCase().replace('.', '');
    const extensionConfig = this._allowedFileConfig[ext];

    if (!extensionConfig || !extensionConfig.mimes) {
      return [];
    }

    return extensionConfig.mimes;
  }

  getMaxBytesForExtensionInApp(extension: string, app: StorageAppKeys): number {
    const ext = extension.toLowerCase().replace('.', '');
    const extensionConfig = this._allowedFileConfig[ext];

    if (!extensionConfig) {
      return 0;
    }

    return extensionConfig[app] || 0;
  }

  getAvailableApps(clone?: boolean): TargetAppsEnum[] {
    if (clone) {
      return [...StorageAppsInverseList];
    }

    return StorageAppsInverseList;
  }

  // Factory method
  static create(
    userId: UserId,
    storageTierId: string,
    allowedFileConfig: IAllowedFileConfig,
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

  // Invariants validation
  private validateInvariants(): void {
    this.validateFileConfig(this._allowedFileConfig);
  }

  private validateFileConfig(fileConfig: IAllowedFileConfig): void {
    if (Object.keys(fileConfig).length === 0) {
      throw new Error('At least one file type must be allowed');
    }

    // Validate that each extension has at least one mime type
    for (const [extension, config] of Object.entries(fileConfig)) {
      if (!config || !config.mimes || config.mimes.length === 0) {
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
