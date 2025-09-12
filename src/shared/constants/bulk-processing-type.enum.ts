import { Inject, Injectable } from '@nestjs/common';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { Email } from '@core/value-objects/email.vo';
import { IUserForAuth } from '@presentation/guards/permissions.guard';
import { BulkProcessingInsufficientPermissionsException } from '@core/exceptions/bulk-processing.exceptions';

export const GLOBAL_RESOURCE: string = 'bulk-processing';

export enum ActiveResources {
  PRODUCTS = 'products',
  INTERNAL = 'internal',
}

export type ActiveActions = 'manage-events' | 'write' | 'delete';

export enum BulkProcessingType {
  PRODUCT_CATALOG = 'PRODUCT_CATALOG',
  CLEANUP_TEMP_FILES = 'CLEANUP_TEMP_FILES',
}

export enum BulkProcessingEventType {
  PRODUCT_CATALOG_BULK_IMPORT = 'PRODUCT_CATALOG_BULK_IMPORT',
  CLEANUP_TEMP_FILES = 'BULK_PROCESSING_CLEANUP',
}

export const ExcelJobs = new Set([BulkProcessingType.PRODUCT_CATALOG]);

export const EventProcessingMap: Record<
  BulkProcessingEventType,
  { resource: ActiveResources; processingType: BulkProcessingType }
> = {
  [BulkProcessingEventType.PRODUCT_CATALOG_BULK_IMPORT]: {
    resource: ActiveResources.PRODUCTS,
    processingType: BulkProcessingType.PRODUCT_CATALOG,
  },
  [BulkProcessingEventType.CLEANUP_TEMP_FILES]: {
    resource: ActiveResources.INTERNAL,
    processingType: BulkProcessingType.CLEANUP_TEMP_FILES,
  },
};

const entries = Object.entries(EventProcessingMap) as Array<
  [BulkProcessingEventType, { resource: ActiveResources; processingType: BulkProcessingType }]
>;

export const InternalEvents: BulkProcessingEventType[] = entries
  .filter(([, v]) => v.resource === ActiveResources.INTERNAL)
  .map(([k]) => k);

export const InternalProcessings: BulkProcessingType[] = Array.from(
  new Set(
    entries
      .filter(([, v]) => v.resource === ActiveResources.INTERNAL)
      .map(([, v]) => v.processingType),
  ),
);

export const getResourceKey = (resource: ActiveResources, action: ActiveActions): string => {
  return `${GLOBAL_RESOURCE}-${resource}:${action}`;
};

@Injectable()
export class BulkProcessingTypeGuard {
  constructor(
    @Inject(UserAuthorizationService)
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  isReservedType(type: BulkProcessingType): boolean {
    return InternalProcessings.includes(type);
  }

  canAccessProcessingType(
    type: BulkProcessingType,
    jwtPayload: IJwtPayload,
    action: ActiveActions,
  ): void {
    let result: boolean = false;
    let resource: ActiveResources | null = null;

    // Any processing not mapped here is intentional to prevent access to it.
    switch (type) {
      case BulkProcessingType.PRODUCT_CATALOG:
        resource = ActiveResources.PRODUCTS;
        result = this.canAccess(jwtPayload, resource, action);
        break;
      default:
        break;
    }

    if (!result) {
      throw new BulkProcessingInsufficientPermissionsException(
        action,
        !resource ? 'UNKNOWN' : `${GLOBAL_RESOURCE}-${resource}`,
      );
    }
  }

  canAccessEventType(
    type: BulkProcessingEventType,
    jwtPayload: IJwtPayload,
    action?: ActiveActions,
  ): void {
    const data = EventProcessingMap[type];

    if (!data) {
      throw new BulkProcessingInsufficientPermissionsException(
        'manage-events',
        `${GLOBAL_RESOURCE}-UNKNOWN_EVENT`,
      );
    }

    if (action) {
      this.canAccessProcessingType(data.processingType, jwtPayload, action);
    }

    this.canAccessProcessingType(data.processingType, jwtPayload, 'manage-events');
  }

  private canAccess(
    jwtPayload: IJwtPayload,
    resource: ActiveResources,
    action: ActiveActions,
  ): boolean {
    const perms = new Set<string>(jwtPayload.permissions ?? []);
    const userForAuth: IUserForAuth = {
      email: new Email(jwtPayload.email),
      isActive: jwtPayload.isActive,
      rolesCollection: {
        getAllPermissions: () => ({
          toArray: () => Array.from(perms).map(p => ({ name: p })),
        }),
      },
      hasPermission: (permissionName: string) => perms.has(permissionName),
    };

    return this.userAuthorizationService.canAccessResource(
      userForAuth,
      `${GLOBAL_RESOURCE}-${resource}`,
      action,
    );
  }
}
