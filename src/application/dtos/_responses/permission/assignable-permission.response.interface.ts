export interface IAssignablePermissionResponse {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  canAssign: boolean;
  excludeReason?: string;
}
