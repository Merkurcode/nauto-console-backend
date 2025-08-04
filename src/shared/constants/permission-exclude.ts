// Permission exclude symbols
export const PERMISSION_EXCLUDE_SYMBOLS = {
  ALL_ROLES: '*', // Exclude all roles
  CUSTOM_ROLES: '**', // Exclude all custom roles (isDefaultAppRole: false)
  ALL_EXCEPT: '*!', // Exclude all roles except the ones listed after this symbol
  DEFAULT_ROLES: '***', // Exclude all default roles (isDefaultAppRole: true), allowing only custom roles
  ALLOW_CUSTOM_AND_LISTED: '*+', // Allow all custom roles plus the specific roles listed after this symbol
} as const;

export const ALLOW_ALL_ROLES = null;

export type PermissionExcludeSymbol =
  (typeof PERMISSION_EXCLUDE_SYMBOLS)[keyof typeof PERMISSION_EXCLUDE_SYMBOLS];
