import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';
import { ICurrentUserPermissionResponse } from '@application/dtos/responses/current-user-permission.response';

export class GetCurrentUserPermissionsQuery {
  constructor(public readonly userId: string) {}
}

@QueryHandler(GetCurrentUserPermissionsQuery)
export class GetCurrentUserPermissionsQueryHandler
  implements IQueryHandler<GetCurrentUserPermissionsQuery>
{
  constructor(
    @Inject(REPOSITORY_TOKENS.USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(query: GetCurrentUserPermissionsQuery): Promise<ICurrentUserPermissionResponse[]> {
    const { userId } = query;

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const permissions: ICurrentUserPermissionResponse[] = [];

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
    return permissions.sort((a, b) => {
      if (a.resource !== b.resource) {
        return a.resource.localeCompare(b.resource);
      }
      return a.action.localeCompare(b.action);
    });
  }
}
