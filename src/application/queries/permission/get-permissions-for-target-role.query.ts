import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PermissionExcludeService } from '@core/services/permission-exclude.service';
import { PermissionResponseMapper } from '@application/mappers/permission-response.mapper';
import { IAssignablePermissionResponse } from '@application/dtos/_responses/permission/assignable-permission.response.interface';

export class GetPermissionsForTargetRoleQuery {
  constructor(public readonly targetRoleName: string) {}
}

@QueryHandler(GetPermissionsForTargetRoleQuery)
export class GetPermissionsForTargetRoleQueryHandler
  implements IQueryHandler<GetPermissionsForTargetRoleQuery>
{
  constructor(private readonly permissionExcludeService: PermissionExcludeService) {}

  async execute(query: GetPermissionsForTargetRoleQuery): Promise<IAssignablePermissionResponse[]> {
    const { targetRoleName } = query;

    const result = await this.permissionExcludeService.getPermissionsForTargetRole(targetRoleName);

    return PermissionResponseMapper.toAssignablePermissionResponseArray(result);
  }
}
