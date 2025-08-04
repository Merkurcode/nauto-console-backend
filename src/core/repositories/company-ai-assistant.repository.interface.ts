import { CompanyAIAssistant } from '../entities/company-ai-assistant.entity';

export interface ICompanyAIAssistantRepository {
  findByCompanyId(companyId: string): Promise<CompanyAIAssistant[]>;
  findByCompanyIdAndAssistantId(
    companyId: string,
    assistantId: string,
  ): Promise<CompanyAIAssistant | null>;
  create(assignment: CompanyAIAssistant): Promise<CompanyAIAssistant>;
  update(assignment: CompanyAIAssistant): Promise<CompanyAIAssistant>;
  delete(id: string): Promise<void>;
  toggleAssistantStatus(
    companyId: string,
    assistantId: string,
    enabled: boolean,
  ): Promise<CompanyAIAssistant>;
  toggleFeatureStatus(assignmentId: string, featureId: string, enabled: boolean): Promise<void>;
}
