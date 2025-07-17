import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IRoleRepository } from '@core/repositories/role.repository.interface';
import { RoleDetailResponse } from '@application/dtos/responses/role.response';
import { RoleMapper } from '@application/mappers/role.mapper';
import { ROLE_REPOSITORY } from '@shared/constants/tokens';

export class GetRolesQuery implements IQuery {
  constructor(public readonly companyId?: string) {}
}

@QueryHandler(GetRolesQuery)
export class GetRolesQueryHandler implements IQueryHandler<GetRolesQuery> {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
  ) {}

  async execute(): Promise<RoleDetailResponse[]> {
    const roles = await this.roleRepository.findAll();

    // Use the mapper to convert each role to response DTO
    return roles.map(role => RoleMapper.toDetailResponse(role));
  }
}
