export interface IPermissionResponse {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
}

export interface IRoleBaseResponse {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  isDefaultAppRole: boolean;
}

export interface IRoleDetailResponse extends IRoleBaseResponse {
  permissions: IPermissionResponse[];
  createdAt: Date;
  updatedAt: Date;
}
