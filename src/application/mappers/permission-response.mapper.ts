import { IAssignablePermissionResponse } from '@application/dtos/_responses/permission/assignable-permission.response';
import { ICurrentUserPermissionResponse } from '@application/dtos/_responses/permission/current-user-permission.response';
import { IAssignablePermissionResponse as IAssignablePermissionModuleResponse } from '@application/dtos/_responses/permission/assignable-permission.response.interface';
import { ICurrentUserPermissionResponse as ICurrentUserPermissionModuleResponse } from '@application/dtos/_responses/permission/current-user-permission.response.interface';

export class PermissionResponseMapper {
  public static toAssignablePermissionResponse(
    source: IAssignablePermissionResponse,
  ): IAssignablePermissionModuleResponse {
    return {
      id: source.id,
      name: source.name,
      description: source.description,
      resource: source.resource,
      action: source.action,
      canAssign: source.canAssign,
      excludeReason: source.excludeReason,
    };
  }

  public static toAssignablePermissionResponseArray(
    sources: IAssignablePermissionResponse[],
  ): IAssignablePermissionModuleResponse[] {
    return sources.map(this.toAssignablePermissionResponse);
  }

  public static toCurrentUserPermissionResponse(
    source: ICurrentUserPermissionResponse,
  ): ICurrentUserPermissionModuleResponse {
    return {
      id: source.id,
      name: source.name,
      description: source.description,
      resource: source.resource,
      action: source.action,
      grantedByRole: source.grantedByRole,
    };
  }

  public static toCurrentUserPermissionResponseArray(
    sources: ICurrentUserPermissionResponse[],
  ): ICurrentUserPermissionModuleResponse[] {
    return sources.map(this.toCurrentUserPermissionResponse);
  }
}
