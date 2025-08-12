import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { RoleService } from '@core/services/role.service';
import { IRoleDetailResponse } from '@application/dtos/_responses/role/role.response';
import { RoleMapper } from '@application/mappers/role.mapper';

export class GetRolesQuery implements IQuery {
  constructor(public readonly companyId?: string) {}
}

@QueryHandler(GetRolesQuery)
export class GetRolesQueryHandler implements IQueryHandler<GetRolesQuery> {
  constructor(private readonly roleService: RoleService) {}

  async execute(): Promise<IRoleDetailResponse[]> {
    const roles = await this.roleService.getAllRoles();

    // Use the mapper to convert each role to response DTO
    return roles.map(role => RoleMapper.toDetailResponse(role));
  }
}
