import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PermissionExcludeService } from '@core/services/permission-exclude.service';
import { IAssignablePermissionResponse } from '@application/dtos/responses/assignable-permission.response';

export class GetAssignablePermissionsQuery {
  constructor(
    public readonly currentUserRoleNames: string | string[],
    public readonly targetRoleName?: string, // Optional: check if current role can assign permissions to this target role
  ) {}
}

@QueryHandler(GetAssignablePermissionsQuery)
export class GetAssignablePermissionsQueryHandler
  implements IQueryHandler<GetAssignablePermissionsQuery>
{
  constructor(private readonly permissionExcludeService: PermissionExcludeService) {}

  async execute(query: GetAssignablePermissionsQuery): Promise<IAssignablePermissionResponse[]> {
    const { currentUserRoleNames, targetRoleName } = query;

    return await this.permissionExcludeService.getAssignablePermissionsForMultipleRoles(
      currentUserRoleNames,
      targetRoleName,
    );
  }
}
