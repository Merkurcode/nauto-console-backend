import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

export enum ActionType {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  MANAGE = 'manage',
  UPDATE = 'update',
  ASSIGN = 'assign',
  REMOVE = 'remove',
}

export class ResourceAction {
  private readonly resource: string;
  private readonly action: ActionType;

  constructor(resource: string, action: ActionType | string) {
    if (!this.isValidResource(resource)) {
      throw new InvalidValueObjectException('Invalid resource name');
    }

    const actionValue = typeof action === 'string' ? this.parseActionType(action) : action;

    this.resource = resource.toLowerCase();
    this.action = actionValue;
  }

  private isValidResource(resource: string): boolean {
    // Resource name should be lowercase alphanumeric and cannot be empty
    return /^[a-z0-9-]+$/.test(resource) && resource.length > 0;
  }

  private parseActionType(action: string): ActionType {
    if (Object.values(ActionType).includes(action as ActionType)) {
      return action as ActionType;
    }
    throw new InvalidValueObjectException('Invalid action type');
  }

  getResource(): string {
    return this.resource;
  }

  getAction(): ActionType {
    return this.action;
  }

  getPermissionName(): string {
    return `${this.resource}:${this.action}`;
  }

  equals(resourceAction: ResourceAction): boolean {
    return (
      this.resource === resourceAction.getResource() && this.action === resourceAction.getAction()
    );
  }
}
