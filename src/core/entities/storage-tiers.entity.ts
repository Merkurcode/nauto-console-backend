import { AggregateRoot } from '@core/events/domain-event.base';
import { StorageBytes } from '@core/value-objects/storage-bytes.vo';
import { MaxSimultaneousFiles } from '@core/value-objects/max-simultaneous-files.vo';
import {
  StorageTierCreatedEvent,
  StorageTierUpdatedEvent,
} from '@core/events/storage-tiers.events';

export class StorageTiers extends AggregateRoot {
  private readonly _id: string;
  private _name: string;
  private _level: string;
  private _maxStorageBytes: StorageBytes;
  private _maxSimultaneousFiles: MaxSimultaneousFiles;
  private _isActive: boolean;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(
    id: string,
    name: string,
    level: string,
    maxStorageBytes: StorageBytes,
    maxSimultaneousFiles: MaxSimultaneousFiles,
    isActive: boolean,
    createdAt: Date,
    updatedAt: Date,
  ) {
    super();
    this._id = id;
    this._name = name;
    this._level = level;
    this._maxStorageBytes = maxStorageBytes;
    this._maxSimultaneousFiles = maxSimultaneousFiles;
    this._isActive = isActive;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;

    this.validateInvariants();
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get level(): string {
    return this._level;
  }

  get maxStorageBytes(): StorageBytes {
    return this._maxStorageBytes;
  }

  get maxSimultaneousFiles(): MaxSimultaneousFiles {
    return this._maxSimultaneousFiles;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Business methods
  updateName(newName: string): void {
    if (this._name === newName) {
      return; // No change needed
    }

    const oldValue = this._name;
    this._name = newName;
    this._updatedAt = new Date();

    this.addDomainEvent(new StorageTierUpdatedEvent(this._id, 'name', oldValue, newName));
  }

  updateLevel(newLevel: string): void {
    if (this._level === newLevel) {
      return; // No change needed
    }

    const oldValue = this._level;
    this._level = newLevel;
    this._updatedAt = new Date();

    this.addDomainEvent(new StorageTierUpdatedEvent(this._id, 'level', oldValue, newLevel));
  }

  updateMaxStorage(newMaxStorageBytes: StorageBytes): void {
    if (this._maxStorageBytes.equals(newMaxStorageBytes)) {
      return; // No change needed
    }

    const oldValue = this._maxStorageBytes;
    this._maxStorageBytes = newMaxStorageBytes;
    this._updatedAt = new Date();

    this.addDomainEvent(
      new StorageTierUpdatedEvent(
        this._id,
        'maxStorageBytes',
        oldValue.toString(),
        newMaxStorageBytes.toString(),
      ),
    );
  }

  updateMaxSimultaneousFiles(newMaxSimultaneousFiles: MaxSimultaneousFiles): void {
    if (this._maxSimultaneousFiles.equals(newMaxSimultaneousFiles)) {
      return; // No change needed
    }

    const oldValue = this._maxSimultaneousFiles;
    this._maxSimultaneousFiles = newMaxSimultaneousFiles;
    this._updatedAt = new Date();

    this.addDomainEvent(
      new StorageTierUpdatedEvent(
        this._id,
        'maxSimultaneousFiles',
        oldValue.toString(),
        newMaxSimultaneousFiles.toString(),
      ),
    );
  }

  activate(): void {
    if (this._isActive) {
      return; // Already active
    }

    this._isActive = true;
    this._updatedAt = new Date();

    this.addDomainEvent(new StorageTierUpdatedEvent(this._id, 'isActive', 'false', 'true'));
  }

  deactivate(): void {
    if (!this._isActive) {
      return; // Already inactive
    }

    this._isActive = false;
    this._updatedAt = new Date();

    this.addDomainEvent(new StorageTierUpdatedEvent(this._id, 'isActive', 'true', 'false'));
  }

  // Query methods
  canUploadFiles(fileCount: number): boolean {
    return this._maxSimultaneousFiles.canUploadFiles(fileCount);
  }

  getMaxStorageInMB(): number {
    return this._maxStorageBytes.toMegabytes();
  }

  getMaxStorageInBytes(): bigint {
    return this._maxStorageBytes.getValue();
  }

  // Factory method
  static create(
    name: string,
    level: string,
    maxStorageBytes: StorageBytes,
    maxSimultaneousFilesValue: number = 10,
    isActive: boolean = true,
  ): StorageTiers {
    const maxSimultaneousFiles = MaxSimultaneousFiles.create(maxSimultaneousFilesValue);

    const tier = new StorageTiers(
      crypto.randomUUID(),
      name,
      level,
      maxStorageBytes,
      maxSimultaneousFiles,
      isActive,
      new Date(),
      new Date(),
    );

    tier.addDomainEvent(new StorageTierCreatedEvent(name, level, maxStorageBytes));

    return tier;
  }

  // Invariants validation
  private validateInvariants(): void {
    if (!this._name || this._name.trim().length === 0) {
      throw new Error('Storage tier name cannot be empty');
    }

    if (!this._level || this._level.trim().length === 0) {
      throw new Error('Storage tier level cannot be empty');
    }
  }

  // Serialization for persistence
  public toJSON(): Record<string, unknown> {
    return {
      id: this._id,
      name: this._name,
      level: this._level,
      maxStorageBytes: this._maxStorageBytes.getValue().toString(),
      maxSimultaneousFiles: this._maxSimultaneousFiles.getValue(),
      isActive: this._isActive,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
