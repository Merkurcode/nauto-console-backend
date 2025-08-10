import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { UserService } from '@core/services/user.service';
import { PermissionResponseMapper } from '@application/mappers/permission-response.mapper';
import { ICurrentUserPermissionResponse } from '@application/dtos/_responses/permission/current-user-permission.response.interface';

export class GetCurrentUserPermissionsQuery {
  constructor(public readonly userId: string) {}
}

@QueryHandler(GetCurrentUserPermissionsQuery)
export class GetCurrentUserPermissionsQueryHandler
  implements IQueryHandler<GetCurrentUserPermissionsQuery>
{
  constructor(private readonly userService: UserService) {}

  async execute(query: GetCurrentUserPermissionsQuery): Promise<ICurrentUserPermissionResponse[]> {
    const { userId } = query;

    const user = await this.userService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const permissions = [];

    // Extract all permissions from all user roles
    for (const role of user.roles) {
      for (const permission of role.permissions) {
        // Avoid duplicates
        const existingPermission = permissions.find(p => p.name === permission.getPermissionName());
        if (!existingPermission) {
          permissions.push({
            id: permission.id.getValue(),
            name: permission.getPermissionName(),
            description: permission.description,
            resource: permission.resourceAction.getResource(),
            action: permission.resourceAction.getAction(),
            grantedByRole: role.name,
          });
        }
      }
    }

    // Sort permissions by resource and then by action
    const sortedPermissions = permissions.sort((a, b) => {
      if (a.resource !== b.resource) {
        return a.resource.localeCompare(b.resource);
      }

      return a.action.localeCompare(b.action);
    });

    // Convert to response interfaces
    return PermissionResponseMapper.toCurrentUserPermissionResponseArray(sortedPermissions);
  }
}
