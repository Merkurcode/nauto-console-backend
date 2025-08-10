import { Injectable, Inject } from '@nestjs/common';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { Host } from '@core/value-objects/host.vo';
import { Company } from '@core/entities/company.entity';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';

@Injectable()
export class TenantResolverService {
  constructor(
    @Inject(REPOSITORY_TOKENS.COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
  ) {}

  async resolveTenantFromHost(host: string): Promise<Company | null> {
    if (!host) {
      return null;
    }

    try {
      const hostVO = new Host(host);

      return await this.companyRepository.findByHost(hostVO);
    } catch (_error) {
      // Invalid host format
      return null;
    }
  }

  extractHostFromRequest(request: {
    headers?: { host?: string; 'x-forwarded-host'?: string; 'x-original-host'?: string };
    get?: (key: string) => string;
  }): string | null {
    // Extract host from different sources
    const host =
      request.headers?.host ||
      request.headers?.['x-forwarded-host'] ||
      request.headers?.['x-original-host'] ||
      request.get?.('host');

    if (!host) {
      return null;
    }

    // Remove port if present
    const hostWithoutPort = host.split(':')[0];

    return hostWithoutPort;
  }
}
