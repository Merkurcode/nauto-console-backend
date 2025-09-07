/**
 * Path types for storage structure
 */
export enum PathType {
  USER = 'users',
  COMMON = 'common',
}

/**
 * Common folder enumeration for shared areas
 */
export enum CommonFolder {
  PRODUCTS = 'products',
  MARKETING = 'marketing',
}

/**
 * String literal types for storage areas
 */
export type StorageAreaType = 'products' | 'marketing';

/**
 * Valid storage area values as const array
 */
export const STORAGE_AREAS = ['products', 'marketing'] as const;

/**
 * Type guard to check if a string is a valid storage area
 */
export function isValidStorageArea(area: string): area is StorageAreaType {
  return STORAGE_AREAS.includes(area as StorageAreaType);
}

/**
 * Mapping between string areas and CommonFolder enum
 */
export const AREA_TO_COMMON_FOLDER_MAP = {
  products: CommonFolder.PRODUCTS,
  marketing: CommonFolder.MARKETING,
} as const;

/**
 * Reverse mapping from CommonFolder enum to string areas
 */
export const COMMON_FOLDER_TO_AREA_MAP = {
  [CommonFolder.PRODUCTS]: 'products',
  [CommonFolder.MARKETING]: 'marketing',
} as const;

export const buildCommonPath = (
  companyId: string,
  area: CommonFolder,
  section?: string,
): string => {
  const path = `${companyId}/${PathType.COMMON}/${area}`;
  if (section) {
    return `${path}/${section}`;
  }

  return path;
};
