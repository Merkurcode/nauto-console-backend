import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PermissionExcludeService } from '@core/services/permission-exclude.service';
import { PermissionResponseMapper } from '@application/mappers/permission-response.mapper';
import { IAssignablePermissionResponse } from '@application/dtos/_responses/permission/assignable-permission.response.interface';

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

    const result = await this.permissionExcludeService.getAssignablePermissionsForMultipleRoles(
      currentUserRoleNames,
      targetRoleName,
    );

    return PermissionResponseMapper.toAssignablePermissionResponseArray(result);
  }
}
