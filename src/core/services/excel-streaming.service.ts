import { Injectable, Inject } from '@nestjs/common';
import { Readable } from 'node:stream';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import XlsxStreamReader = require('xlsx-stream-reader');
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ConfigService } from '@nestjs/config';
import { IBulkProcessingContext } from './bulk-processing.service';
import { UserStorageConfigService } from './user-storage-config.service';
import { BulkProcessingRequest } from '@core/entities/bulk-processing-request.entity';

// ====== Tipos públicos (compatibles con tu código previo) ======

export interface IExcelColumnMapping {
  // Clave: nombre del campo de tu dominio | Valor: nombre exacto de la columna en Excel (header visible)
  [fieldName: string]: string;
}

export interface IExcelParsingOptions {
  fileName: string;
  eventType: string;
  sheetName?: string | number; // si no se provee, toma la primera hoja
  columnMapping: IExcelColumnMapping;
  startRow?: number; // 0-based; 0 = header; default 1 = primera fila de datos
  maxRows?: number; // límite suave (para pruebas)
  skipEmptyRows?: boolean; // default true
  trimValues?: boolean; // default true
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

export interface IExcelValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];

  //transformedData: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface IExcelRowProcessor<T = Record<string, any>> {
  processRow(
    rowData: T,
    rowNumber: number, // 1-based (como Excel)
    context?: IBulkProcessingContext,
  ): Promise<IExcelValidationResult>;

  onStart?(totalRows: number, context?: IBulkProcessingContext): Promise<void>;
  onComplete?(
    processedCount: number,
    errorCount: number,
    context?: IBulkProcessingContext,
  ): Promise<void>;
  onError?(error: Error, context?: IBulkProcessingContext): Promise<void>;

  onBatchUpdate(
    processedCount: number,
    successfulCount: number,
    failedCount: number,
    context?: IBulkProcessingContext,
  ): Promise<void>;

  getParsingOptionsForEventType(
    eventType: string,
    context: IBulkProcessingContext,
  ): IExcelParsingOptions;

  createNewRow(): T;

  setLogs(bulkRequest: BulkProcessingRequest, result: IExcelStreamingResult): Promise<void>;

  /**
   * Determines if this processor will handle completion internally (e.g., with second phase)
   * or if the service should complete the bulk request
   * @returns true if processor handles completion, false if service should complete
   */
  handlesCompletion(): boolean;

  /**
   * Gets state management configuration for this processor
   * Tells the service what the processor handles vs what the service should handle
   */
  getStateManagementConfig(): {
    handlesCompletion: boolean;
    handlesFileStatusRestoration: boolean;
    handlesProgressUpdates: boolean;
    handlesErrorStates: boolean;
  };

  /**
   * Called before processing starts - processor controls initialization
   */
  onBeforeProcessing?(context: IBulkProcessingContext): Promise<void>;

  /**
   * Called when processing completes successfully - processor controls completion
   */
  onProcessingComplete?(result: IExcelStreamingResult): Promise<void>;

  /**
   * Called when processing fails - processor controls failure handling
   */
  onProcessingFailed?(error: Error, context: IBulkProcessingContext): Promise<void>;

  /**
   * Called when processing is cancelled - processor controls cancellation
   */
  onProcessingCancelled?(context: IBulkProcessingContext): Promise<void>;

  /**
   * Determines if file status should be restored for different events
   */
  shouldRestoreFileStatus?(event: 'completion' | 'failure' | 'cancellation'): boolean;

  /**
   * Gets custom progress update for different phases
   */
  getProgressUpdate?(phase: 'start' | 'processing' | 'completion', currentProgress: number): number;

  /**
   * This method allows the service to pass the latest entity state with correct counters
   */
  setBulkRequestEntity?(updatedEntity: BulkProcessingRequest): void;
  getBulkRequestEntity?(): BulkProcessingRequest | null;
}

export interface IExcelStreamingResult {
  eventType: string;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  errors: Array<{
    rowNumber: number;
    errors: string[];
    warnings: string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>;
  }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

// ====== Implementación ======

@Injectable()
export class ExcelStreamingService {
  constructor(
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
    private readonly configService: ConfigService,
    private readonly userStorageConfigService: UserStorageConfigService,
  ) {
    this.logger.setContext(ExcelStreamingService.name);
  }

  /**
   * Procesa un XLSX en streaming, sin materializar el workbook.
   * - inputStream: Readable (p.ej., de S3 getObject)
   * - options: incluye mapping fieldName->ExcelHeader (lo invertimos internamente)
   * - processor: callbacks por fila
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async processExcelStream<T = Record<string, any>>(
    inputStream: Readable,
    options: IExcelParsingOptions,
    processor: IExcelRowProcessor<T>,
    context: IBulkProcessingContext,
  ): Promise<IExcelStreamingResult> {
    const result: IExcelStreamingResult = {
      eventType: options.eventType,
      totalRows: 0,
      processedRows: 0,
      successfulRows: 0,
      failedRows: 0,
      errors: [],
      metadata: options.metadata ?? {},
    };

    await this.userStorageConfigService.clearCache(context?.userId);

    const maxStoredErrors =
      context?.options?.maxStoredErrors ??
      this.configService.get<number>('queue.bulkProcessing.maxStoredErrors', 1000);

    const maxStoredWarnings =
      context?.options?.maxStoredWarnings ??
      this.configService.get<number>('queue.bulkProcessing.maxStoredWarnings', 1000);

    // Normaliza encabezados: ExcelHeader -> fieldName (invertimos mapping para búsqueda O(1))
    const headerMap = this.buildHeaderMap(options.columnMapping);

    // Check if we're using index-based mapping
    const isIndexBasedMapping =
      headerMap.size === 0 && Object.keys(options.columnMapping).length > 0;

    const startRow0 = options.startRow ?? 1; // 0-based: 0=encabezado; 1=1ra fila de datos
    const maxRows = options.maxRows ?? Number.MAX_SAFE_INTEGER;
    const trim = options.trimValues !== false;
    const skipEmpty = options.skipEmptyRows !== false;

    const wb = new XlsxStreamReader();

    let excelHeadersNorm: string[] | null = null; // encabezados normalizados (ordenados)
    let countedRows = 0; // filas de datos contadas
    let chain = Promise.resolve(); // serializa el trabajo por fila (evita fan-out en RAM)

    // Aviso de inicio (no siempre conocemos total real)
    if (processor.onStart) {
      await processor.onStart(0, context);
    }

    wb.on(
      'worksheet',
      (ws: {
        id: number;
        name: string;
        skip: () => void;
        on: (event: string, handler) => void;
        process: () => void;
      }) => {
        // Si se especifica sheetName, usa esa. Si no, usa la primera y salta el resto.
        if (options.sheetName) {
          if (!this.shouldProcessSheet(ws, options.sheetName)) {
            ws.skip();

            return;
          }
        } else if (ws.id > 1) {
          ws.skip();

          return;
        }

        ws.on('row', (row: { attributes?: { r?: number }; values: unknown[] }) => {
          const excelRowNum = Number(row.attributes?.r ?? 0); // Excel 1-based
          const cells = row.values as unknown[]; // indexado desde 1

          // Primera fila que llega la tomamos como encabezados (solo para mapeo por nombre)
          if (!excelHeadersNorm && !isIndexBasedMapping) {
            excelHeadersNorm = [];
            for (let i = 1; i < cells.length; i++) {
              excelHeadersNorm.push(this.norm(String(cells[i] ?? `col${i}`)));
            }

            return;
          }

          // For index-based mapping, skip header row but mark as processed
          if (!excelHeadersNorm && isIndexBasedMapping) {
            excelHeadersNorm = ['processed']; // Just mark that we've seen the header
            if (startRow0 === 0) {
              // If startRow is 0, we should process the header row as data
            } else {
              return; // Skip header row
            }
          }

          // Salta filas hasta alcanzar startRow0
          const dataRowIndex0 = excelRowNum - 1; // 0-based
          if (dataRowIndex0 < startRow0) return;

          if (countedRows >= maxRows) return;
          countedRows++;

          // Construye objeto mapeado fieldName->valor
          const rowObj: T = processor.createNewRow();

          if (isIndexBasedMapping) {
            // Index-based mapping: use column indices directly
            for (const [fieldName, columnRef] of Object.entries(options.columnMapping)) {
              const colIndex = this.getColumnIndex(columnRef);
              const v = cells[colIndex + 1]; // cells array is 1-indexed

              let val: string | number | Date | null =
                v === null ? null : v instanceof Date ? v : typeof v === 'number' ? v : String(v);

              if (typeof val === 'string' && trim) val = val.trim();
              rowObj[fieldName] = val;
            }
          } else {
            // Traditional header-based mapping
            for (let i = 0; i < excelHeadersNorm.length; i++) {
              const excelHeader = excelHeadersNorm[i];
              const fieldName = headerMap.get(excelHeader);
              if (!fieldName) continue;

              const v = cells[i + 1];
              let val: string | number | Date | null =
                v === null ? null : v instanceof Date ? v : typeof v === 'number' ? v : String(v);

              if (typeof val === 'string' && trim) val = val.trim();
              rowObj[fieldName] = val;
            }
          }

          if (skipEmpty && this.isEmptyRow(rowObj)) return;

          // Serializa el procesamiento para mantener uso de memoria ultra bajo
          chain = chain.then(async () => {
            // Check for cancellation before processing each row (outside try-catch to allow cancellation to propagate)
            await context?.cancellationChecker?.();

            try {
              const res = await processor.processRow(rowObj, excelRowNum, context);
              result.processedRows++;
              if (res.isValid) {
                result.successfulRows++;
              } else {
                result.failedRows++;
                if (res.errors.length || res.warnings.length) {
                  // Determina si debe almacenar según el tipo de problemas
                  const shouldStoreErrors =
                    res.errors.length > 0 && result.errors.length < maxStoredErrors;
                  const shouldStoreWarnings = res.warnings.length > 0 && res.errors.length === 0;

                  // Cuenta cuántos logs de solo warnings ya tenemos
                  const warningsOnlyCount = result.errors.filter(
                    log => log.errors.length === 0 && log.warnings.length > 0,
                  ).length;

                  const shouldStoreWarningsOnly =
                    shouldStoreWarnings && warningsOnlyCount < maxStoredWarnings;

                  if (shouldStoreErrors || shouldStoreWarningsOnly) {
                    result.errors.push({
                      rowNumber: excelRowNum,
                      errors: res.errors,
                      warnings: res.warnings,
                      metadata: res.metadata,
                    });
                  }
                }
              }
              if (result.processedRows % 2 === 0) {
                await processor.onBatchUpdate(
                  result.processedRows,
                  result.successfulRows,
                  result.failedRows,
                  context,
                );
              }
              if (result.processedRows % 1000 === 0) {
                this.logger.debug(
                  `Processed ${result.processedRows} rows (${result.successfulRows} ok, ${result.failedRows} fail)`,
                );
              }
            } catch (e) {
              const error = e instanceof Error ? e : new Error(String(e));

              // Call onError handler if defined
              if (processor.onError) {
                try {
                  await processor.onError(error, context);
                } catch (onErrorErr) {
                  this.logger.error(
                    `Error in onError handler: ${onErrorErr?.message ?? String(onErrorErr)}`,
                  );
                }
              }

              result.processedRows++;
              result.failedRows++;
              if (result.errors.length < maxStoredErrors) {
                result.errors.push({
                  rowNumber: excelRowNum,
                  errors: [`Row processing error: ${error.message}`],
                  warnings: [],
                });
              }
            }
          });
        });

        ws.on('end', () => {
          /* hoja terminada */
        });
        ws.process();
      },
    );

    await new Promise<void>((resolve, reject) => {
      wb.on('end', resolve);
      wb.on('error', reject);
      inputStream.pipe(wb);
    });

    // Asegura que terminamos de procesar la última promesa encadenada
    await chain;

    result.totalRows = countedRows;

    if (processor.onComplete) {
      await processor.onComplete(result.successfulRows, result.failedRows, context);
    }

    this.logger.log(
      `Excel "${options.fileName}" done: ${result.processedRows}/${result.totalRows} ` +
        `(${result.successfulRows} ok, ${result.failedRows} fail)`,
    );

    return result;
  }

  // -------- Helpers --------

  private norm(h: string) {
    return h
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  /**
   * Converts Excel column letter(s) to 0-based index
   * A -> 0, B -> 1, Z -> 25, AA -> 26, etc.
   */
  private columnLetterToIndex(letter: string): number {
    let index = 0;
    for (let i = 0; i < letter.length; i++) {
      index = index * 26 + (letter.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
    }

    return index - 1; // Convert to 0-based
  }

  /**
   * Checks if the mapping value is a column index/letter rather than a header name
   * Supports: numbers (0, 1, 2), string numbers ("0", "1"), letters (A, B, C, AA)
   */
  private isColumnIndexMapping(value: string): boolean {
    // Check if it's a number or string number
    if (!isNaN(Number(value))) {
      return true;
    }
    // Check if it's column letters (A-Z, AA-ZZ, etc.)

    return /^[A-Z]+$/i.test(value);
  }

  /**
   * Converts a column mapping value to a 0-based index
   * Supports: 0, "0", A, a, AA, etc.
   */
  private getColumnIndex(value: string): number {
    // If it's a number, use it directly (assuming 0-based)
    if (!isNaN(Number(value))) {
      return Number(value);
    }
    // If it's letters, convert to index
    if (/^[A-Z]+$/i.test(value)) {
      return this.columnLetterToIndex(value.toUpperCase());
    }

    throw new Error(`Invalid column index/letter: ${value}`);
  }

  private buildHeaderMap(mapping: IExcelColumnMapping): Map<string, string> {
    // Check if this is index-based mapping or header-based mapping
    const mappingValues = Object.values(mapping);
    const isIndexBased =
      mappingValues.length > 0 && mappingValues.every(v => this.isColumnIndexMapping(v));

    if (isIndexBased) {
      // For index-based mapping, we'll handle it differently in the row processing
      // Return empty map as signal that we're using index-based mapping
      return new Map<string, string>();
    }

    // Traditional header-based mapping
    // Invertimos: ExcelHeaderNormalizado -> fieldName
    const m = new Map<string, string>();
    for (const [fieldName, excelHeader] of Object.entries(mapping)) {
      if (!excelHeader) continue;
      m.set(this.norm(excelHeader), fieldName);
    }

    return m;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private isEmptyRow<T = Record<string, any>>(rowData: T): boolean {
    const vals = Object.values(rowData);

    return vals.every(
      v =>
        v === null ||
        (typeof v === 'string' && v.trim() === '') ||
        (typeof v === 'number' && Number.isNaN(v)),
    );
  }

  /** Acepta nombre (string) o índice (number).
   * - number: permite 1-based (1=primera), y también 0 -> primera (0-based tolerante).
   * - string: compara nombre normalizado (trim + lower).
   */
  private shouldProcessSheet(
    ws: { id: number; name: string },
    sheetSel?: string | number,
  ): boolean {
    if (sheetSel === undefined) {
      // Si no se especifica, procesa solo la primera hoja
      return ws.id === 1;
    }

    if (typeof sheetSel === 'number' && Number.isFinite(sheetSel)) {
      // Soporta 1-based (1,2,3,...) y 0-based (0,1,2,...) de forma tolerante
      const idx1 = sheetSel >= 1 ? sheetSel : sheetSel + 1; // 0 -> 1, 1 -> 1, etc.

      return ws.id === idx1;
    }

    // String: compara nombre normalizado
    const want = String(sheetSel);

    return this.normSheetName(ws.name) === this.normSheetName(want);
  }

  private normSheetName(s: string): string {
    return s.trim().toLowerCase();
  }
}
