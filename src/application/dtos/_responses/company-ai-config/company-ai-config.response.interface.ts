import { ICompanyConfigAI } from '@core/interfaces/company-config-ai.interface';

/**
 * Response interface for Company AI Configuration
 * Following Clean Architecture: Application layer response interfaces
 */
export interface ICompanyAIConfigResponse extends ICompanyConfigAI {
  /**
   * Company ID that owns this AI configuration
   */
  companyId: string;

  /**
   * Indicates if the company has any AI configuration set
   */
  hasConfiguration: boolean;

  /**
   * Timestamp when configuration was last updated
   */
  lastUpdated: string | null;
}
