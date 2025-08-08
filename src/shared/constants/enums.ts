export enum RolesEnum {
  ROOT = 'root',
  ROOT_READONLY = 'root_readonly',
  BOT = 'bot',
  ADMIN = 'admin',
  MANAGER = 'manager',
  SALES_AGENT = 'sales_agent',
  HOST = 'host',
  GUEST = 'guest',
}

export enum AssistantAreaEnum {
  BRAND_EXPERT = 'BRAND_EXPERT', // Lily
  MARKETING_ASSISTANT = 'MARKETING_ASSISTANT', // Zoe
  FINCANCE_ASSISTANT = 'FINCANCE_ASSISTANT', // Oscar
  UPSELL_ASSISTANT = 'UPSELL_ASSISTANT', // Niko
}

export enum IndustrySectorEnum {
  AUTOMOTIVE = 'AUTOMOTIVE',
  CUSTOMER_SERVICE = 'CUSTOMER_SERVICE',
  EDUCATION = 'EDUCATION',
  HEALTHCARE = 'HEALTHCARE',
  REAL_ESTATE = 'REAL_ESTATE',
  OTHER = 'OTHER',
}

export enum IndustryOperationChannelEnum {
  ONLINE = 'ONLINE',
  PHYSICAL = 'PHYSICAL',
  MIXED = 'MIXED',
}

export enum LogoutScope {
  LOCAL = 'local',
  GLOBAL = 'global',
}

export enum ActionType {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  MANAGE = 'manage',
  UPDATE = 'update',
  ASSIGN = 'assign',
  REMOVE = 'remove',
  OPERATIONS = 'operations',
  ACCESS = 'access',
}

/**
 * Role hierarchy order from highest to lowest privilege.
 * Lower index means higher privilege level.
 */
export const ROLE_HIERARCHY_ORDER = [
  RolesEnum.ROOT,
  RolesEnum.BOT, // BOT con privilegios ROOT
  RolesEnum.ROOT_READONLY,
  RolesEnum.ADMIN,
  RolesEnum.MANAGER,
  RolesEnum.SALES_AGENT,
  RolesEnum.HOST,
  RolesEnum.GUEST,
] as const;

/**
 * Role hierarchy order using string values (for legacy compatibility).
 * Lower index means higher privilege level.
 */
export const ROLE_HIERARCHY_ORDER_STRINGS = [
  'root',
  'bot', // BOT con privilegios ROOT
  'root_readonly',
  'admin',
  'manager',
  'sales_agent',
  'host',
  'guest',
] as const;
