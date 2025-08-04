export interface ICurrentUserPermissionResponse {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  grantedByRole: string;
}