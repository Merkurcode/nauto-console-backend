/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Comprehensive bulk processing options interface
 * Used across the bulk processing system for consistent option handling
 */

/**
 * Media processing configuration
 */
export interface IBulkProcessingMediaOptions {
  /** Skip downloading and processing media files */
  skipMediaDownload?: boolean;
  /** Continue processing even if media download fails */
  continueOnMediaError?: boolean;
  /** Maximum concurrent media downloads per row */
  maxMediaConcurrency?: number;
  /** Media download timeout in milliseconds */
  mediaDownloadTimeout?: number;
  /** Validate media file extensions before download */
  validateMediaExtensions?: boolean;
  /** Process media in first phase (Excel streaming) vs second phase (after Excel completion) */
  processMediaInFirstPhase?: boolean;
}

/**
 * Validation and error handling configuration
 */
export interface IBulkProcessingValidationOptions {
  /** Skip all validation checks (use with caution) */
  skipValidation?: boolean;
  /** Continue processing even when validation errors occur */
  continueOnValidationError?: boolean;
  /** Treat warnings as errors */
  treatWarningsAsErrors?: boolean;
  /** Maximum number of errors to store per request */
  maxStoredErrors?: number;
  /** Maximum number of warnings to store per request */
  maxStoredWarnings?: number;
}

/**
 * Excel/CSV parsing configuration
 */
export interface IBulkProcessingParsingOptions {
  /** Starting row number (0-based index) */
  startRow?: number;
  /** Skip empty rows during processing */
  skipEmptyRows?: boolean;
  /** Trim whitespace from cell values */
  trimValues?: boolean;
  /** Sheet name or index to process (for Excel files) */
  sheetName?: string | number;
}

/**
 * Processing behavior configuration
 */
export interface IBulkProcessingBehaviorOptions {
  /** Stop processing on first error */
  stopOnFirstError?: boolean;
  /** Enable dry run mode (validate without persisting) */
  dryRun?: boolean;
}

/**
 * Complete bulk processing options
 */
export interface IBulkProcessingOptions {
  /** Media processing configuration */
  mediaProcessing?: IBulkProcessingMediaOptions;
  /** Validation configuration */
  validation?: IBulkProcessingValidationOptions;
  /** Parsing configuration */
  parsing?: IBulkProcessingParsingOptions;
  /** Processing behavior configuration */
  processing?: IBulkProcessingBehaviorOptions;
  /** Custom metadata for tracking */
  metadata?: Record<string, any>;
}

/**
 * Flattened options for backward compatibility
 * This interface represents the flat structure used internally
 */
export interface IBulkProcessingFlatOptions extends Record<string, any> {
  // Media options
  skipMediaDownload?: boolean;
  continueOnMediaError?: boolean;
  maxMediaConcurrency?: number;
  mediaDownloadTimeout?: number;
  validateMediaExtensions?: boolean;
  processMediaInFirstPhase?: boolean; // not implemmented

  // Validation options
  skipValidation?: boolean;
  continueOnValidationError?: boolean;
  treatWarningsAsErrors?: boolean;
  maxStoredErrors?: number;
  maxStoredWarnings?: number;

  // Parsing options
  startRow?: number;
  skipEmptyRows?: boolean;
  trimValues?: boolean;
  sheetName?: string | number;

  // Processing behavior
  stopOnFirstError?: boolean;
  dryRun?: boolean;

  // Metadata
  metadata?: Record<string, any>;

  // Legacy options (for backward compatibility)
  maxConcurrency?: number;
  downloadTimeout?: number;
}
