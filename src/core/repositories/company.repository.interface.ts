import { Company } from '@core/entities/company.entity';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { CompanyName } from '@core/value-objects/company-name.vo';
import { Host } from '@core/value-objects/host.vo';

// Assistant assignment type for repository
export interface IAssistantAssignment {
  aiAssistant: {
    id: string;
    name: string;
    area: string;
    description: unknown; // Prisma JsonValue type
  };
  enabled: boolean;
  features?: {
    aiAssistantFeature: {
      id: string;
      keyName: string;
      title: unknown; // Prisma JsonValue type
      description: unknown; // Prisma JsonValue type
    };
    enabled: boolean;
  }[];
}

export interface ICompanyRepository {
  findById(id: CompanyId): Promise<Company | null>;
  findByIdWithAssistants(
    id: CompanyId,
  ): Promise<{ company: Company | null; assistants: IAssistantAssignment[] }>;
  findByName(name: CompanyName): Promise<Company | null>;
  findByHost(host: Host): Promise<Company | null>;
  findAll(): Promise<Company[]>;
  findAllWithAssistants(): Promise<{
    companies: Company[];
    assistantsMap: Map<string, IAssistantAssignment[]>;
  }>;
  save(company: Company): Promise<Company>;
  update(company: Company): Promise<Company>;
  delete(id: CompanyId): Promise<void>;
  exists(id: CompanyId): Promise<boolean>;
  existsByName(name: CompanyName): Promise<boolean>;
  existsByHost(host: Host): Promise<boolean>;

  // Hierarchy methods
  findSubsidiaries(parentId: CompanyId): Promise<Company[]>;
  findRootCompanies(): Promise<Company[]>;
  findByParentCompany(parentId: CompanyId): Promise<Company[]>;
  countSubsidiaries(parentId: CompanyId): Promise<number>;
}
