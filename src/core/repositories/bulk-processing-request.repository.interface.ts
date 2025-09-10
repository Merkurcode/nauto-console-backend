import { BulkProcessingRequest } from '@core/entities/bulk-processing-request.entity';
import { BulkProcessingType } from '@shared/constants/bulk-processing-type.enum';
import { BulkProcessingStatus } from '@shared/constants/bulk-processing-status.enum';

/**
 * Bulk processing request repository interface
 *
 * Implementations:
 * - {@link BulkProcessingRequest} - Production Prisma/PostgreSQL implementation
 */
export interface IBulkProcessingRequestRepository {
  /**
   * Creates a new bulk processing request
   */
  create(request: BulkProcessingRequest): Promise<BulkProcessingRequest>;

  /**
   * Updates an existing bulk processing request
   */
  update(request: BulkProcessingRequest): Promise<BulkProcessingRequest>;

  /**
   * Finds a bulk processing request by ID and company
   */
  findByIdAndCompany(id: string, companyId: string): Promise<BulkProcessingRequest | null>;

  /**
   * Finds a bulk processing request by JobId and company
   */
  findByJobIddAndCompany(jobId: string, companyId: string): Promise<BulkProcessingRequest | null>;

  /**
   * Finds all bulk processing requests for a company
   */
  findByCompanyId(
    companyId: string,
    limit?: number,
    offset?: number,
  ): Promise<BulkProcessingRequest[]>;

  /**
   * Finds bulk processing requests by status and company
   */
  findByStatusAndCompany(
    status: BulkProcessingStatus,
    companyId: string,
    limit?: number,
    offset?: number,
  ): Promise<BulkProcessingRequest[]>;

  /**
   * Finds bulk processing requests by type and company
   */
  findByTypeAndCompany(
    type: BulkProcessingType,
    companyId: string,
    limit?: number,
    offset?: number,
  ): Promise<BulkProcessingRequest[]>;

  /**
   * Finds bulk processing requests by user and company
   */
  findByUserAndCompany(
    userId: string,
    companyId: string,
    limit?: number,
    offset?: number,
  ): Promise<BulkProcessingRequest[]>;

  /**
   * Counts bulk processing requests by company
   */
  countByCompany(companyId: string): Promise<number>;

  /**
   * Counts bulk processing requests by status and company
   */
  countByStatusAndCompany(status: BulkProcessingStatus, companyId: string): Promise<number>;

  /**
   * Deletes a bulk processing request by ID and company
   */
  delete(id: string, companyId: string): Promise<void>;

  /**
   * Checks if a bulk processing request exists
   */
  exists(id: string, companyId: string): Promise<boolean>;

  /**
   * Finds active (processing) requests for a company
   */
  findActiveByCompany(companyId: string): Promise<BulkProcessingRequest[]>;
}
