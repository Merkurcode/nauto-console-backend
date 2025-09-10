// same as Prisma enum
export enum BulkProcessingType {
  PRODUCT_CATALOG = 'PRODUCT_CATALOG',
  CLEANUP_TEMP_FILES = 'CLEANUP_TEMP_FILES',
  // Future types can be added here
}

export enum BulkProcessingEventType {
  PRODUCT_CATALOG_BULK_IMPORT = 'PRODUCT_CATALOG_BULK_IMPORT',
  CLEANUP_TEMP_FILES = 'BULK_PROCESSING_CLEANUP',
  // Future event types can be added here
}
