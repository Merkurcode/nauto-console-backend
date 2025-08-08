/**
 * Permisos especiales para BOT - OCULTOS Y NO ASIGNABLES
 *
 * Estos permisos NO deben aparecer en:
 * - Listados de permisos disponibles
 * - Interfaces de administración
 * - APIs de asignación de permisos
 *
 * Son generados SOLO programáticamente para tokens BOT
 */

export const BOT_SPECIAL_PERMISSIONS = {
  ALL_ACCESS: 'all:access',
  SYSTEM_ACCESS: 'system:access',
  UNLIMITED_ACCESS: 'unlimited:access',
} as const;

export type BotSpecialPermission =
  (typeof BOT_SPECIAL_PERMISSIONS)[keyof typeof BOT_SPECIAL_PERMISSIONS];

/**
 * Lista de permisos que NUNCA deben ser visibles o asignables
 */
export const HIDDEN_PERMISSIONS: string[] = Object.values(BOT_SPECIAL_PERMISSIONS);

/**
 * Verifica si un permiso es un permiso especial de BOT
 */
export function isBotSpecialPermission(permission: string): boolean {
  return HIDDEN_PERMISSIONS.includes(permission);
}

/**
 * Filtra permisos especiales de BOT de una lista
 */
export function filterBotPermissions(permissions: string[]): string[] {
  return permissions.filter(permission => !isBotSpecialPermission(permission));
}
