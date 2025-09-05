import { DomainException } from './domain-exceptions';

export abstract class ProductCatalogDomainException extends DomainException {}

export class UnauthorizedCatalogAccessException extends ProductCatalogDomainException {
  constructor(catalogId: string, companyId: string) {
    super(
      `Unauthorized access to product catalog ${catalogId} from company ${companyId}`,
      'UNAUTHORIZED_CATALOG_ACCESS',
      { catalogId, companyId },
    );
  }
}
