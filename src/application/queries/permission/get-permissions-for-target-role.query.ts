import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PermissionExcludeService } from '@core/services/permission-exclude.service';
import { IAssignablePermissionResponse } from '@application/dtos/responses/assignable-permission.response';

export class GetPermissionsForTargetRoleQuery {
  constructor(
    public readonly targetRoleName: string,
  ) {}
}

@QueryHandler(GetPermissionsForTargetRoleQuery)
export class GetPermissionsForTargetRoleQueryHandler
  implements IQueryHandler<GetPermissionsForTargetRoleQuery>
{
  constructor(private readonly permissionExcludeService: PermissionExcludeService) {}

  async execute(query: GetPermissionsForTargetRoleQuery): Promise<IAssignablePermissionResponse[]> {
    const { targetRoleName } = query;

    return await this.permissionExcludeService.getPermissionsForTargetRole(targetRoleName);
  }
}