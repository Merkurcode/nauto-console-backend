import { Company } from '@core/entities/company.entity';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { CompanyName } from '@core/value-objects/company-name.vo';
import { Host } from '@core/value-objects/host.vo';

export interface ICompanyRepository {
  findById(id: CompanyId): Promise<Company | null>;
  findByName(name: CompanyName): Promise<Company | null>;
  findByHost(host: Host): Promise<Company | null>;
  findAll(): Promise<Company[]>;
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
