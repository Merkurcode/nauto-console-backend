import { StoragePaths } from '@core/utils/storage-paths';
import {
  CommonFolder,
  StorageAreaType,
  AREA_TO_COMMON_FOLDER_MAP,
  COMMON_FOLDER_TO_AREA_MAP,
  isValidStorageArea,
} from '@shared/types/storage-areas.types';

/**
 * Storage Area Utilities
 *
 * Centralized utilities for handling storage area operations,
 * making it easy to add new areas without code duplication.
 */
export class StorageAreaUtils {
  /**
   * Convert string area to CommonFolder enum
   */
  static areaToCommonFolder(area: StorageAreaType): CommonFolder {
    return AREA_TO_COMMON_FOLDER_MAP[area];
  }

  /**
   * Convert CommonFolder enum to string area
   */
  static commonFolderToArea(commonFolder: CommonFolder): StorageAreaType {
    return COMMON_FOLDER_TO_AREA_MAP[commonFolder];
  }

  /**
   * Generate storage path for a given area
   */
  static getStoragePathForArea(
    area: StorageAreaType,
    companyId: string,
    path: string = '',
  ): string {
    switch (area) {
      case 'products':
        return StoragePaths.forProducts(companyId, path);
      case 'marketing':
        return StoragePaths.forMarketing(companyId, path);
      default:
        // This ensures exhaustive checking at compile time
        const _exhaustiveCheck: never = area;
        throw new Error(`Unknown storage area: ${area}`);
    }
  }

  /**
   * Generate storage path using CommonFolder enum
   */
  static getStoragePathForCommonFolder(
    commonFolder: CommonFolder,
    companyId: string,
    path: string = '',
  ): string {
    const area = this.commonFolderToArea(commonFolder);

    return this.getStoragePathForArea(area, companyId, path);
  }

  /**
   * Validate and parse area string
   */
  static parseAndValidateArea(area: string): StorageAreaType {
    if (!isValidStorageArea(area)) {
      throw new Error(
        `Invalid storage area: ${area}. Valid areas are: ${Object.keys(AREA_TO_COMMON_FOLDER_MAP).join(', ')}`,
      );
    }

    return area;
  }

  /**
   * Get all available storage areas
   */
  static getAvailableAreas(): StorageAreaType[] {
    return Object.keys(AREA_TO_COMMON_FOLDER_MAP) as StorageAreaType[];
  }

  /**
   * Get all available CommonFolder values
   */
  static getAvailableCommonFolders(): CommonFolder[] {
    return Object.values(AREA_TO_COMMON_FOLDER_MAP);
  }
}
