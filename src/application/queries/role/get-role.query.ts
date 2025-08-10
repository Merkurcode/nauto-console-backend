import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { RoleService } from '@core/services/role.service';
import { RoleDetailResponse } from '@application/dtos/_responses/role/role.response';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';
import { RoleMapper } from '@application/mappers/role.mapper';

export class GetRoleQuery implements IQuery {
  constructor(public readonly id: string) {}
}

@QueryHandler(GetRoleQuery)
export class GetRoleQueryHandler implements IQueryHandler<GetRoleQuery> {
  constructor(private readonly roleService: RoleService) {}

  async execute(query: GetRoleQuery): Promise<RoleDetailResponse> {
    const { id } = query;
    const role = await this.roleService.getRoleById(id);

    if (!role) {
      throw new EntityNotFoundException('Role', id);
    }

    // Use the mapper to convert to response DTO
    return RoleMapper.toDetailResponse(role);
  }
}
