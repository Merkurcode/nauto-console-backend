/**
 * Constantes del sistema centralizadas
 * Solo valores literales que se repiten en múltiples archivos del codebase
 */

// ========================================
// RECURSOS CRÍTICOS USADOS EN EL CÓDIGO
// ========================================

// De role.specifications.ts línea 117
export const SPECIFICATION_CRITICAL_RESOURCES = [
  'user',
  'role',
  'permission',
  'system',
  'company',
] as const;

// De domain-validation.service.ts línea 293
export const VALIDATION_CRITICAL_RESOURCES = ['system', 'database', 'security'] as const;

// Recursos que aparecen en hasSystemOrAuditPermissions (línea 317)
export const SYSTEM_AUDIT_RESOURCES = {
  SYSTEM: 'system',
  AUDIT: 'audit',
} as const;

// ========================================
// ACCIONES CRÍTICAS USADAS EN EL CÓDIGO
// ========================================

// De role.specifications.ts línea 118
export const SPECIFICATION_CRITICAL_ACTIONS = ['delete', 'create', 'update'] as const;

// De domain-validation.service.ts línea 292
export const VALIDATION_CRITICAL_ACTIONS = ['delete', 'shutdown', 'configure'] as const;

// ========================================
// PATRONES DE VALIDACIÓN USADOS EN EL CÓDIGO
// ========================================

// De domain-validation.service.ts líneas 280-287 (hasCommonPatterns)
export const PASSWORD_COMMON_PATTERNS = [
  /123/, // Sequential numbers
  /abc/i, // Sequential letters
  /password/i, // Common word
  /qwerty/i, // Keyboard pattern
  /(.)\1{2,}/, // Repeated characters
] as const;

// ========================================
// CONSTANTES NUMÉRICAS USADAS EN EL CÓDIGO
// ========================================

// De domain-validation.service.ts línea 87 (validateRole)
export const MIN_ROLE_NAME_LENGTH = 3;

// ========================================
// HELPERS PARA LOS VALORES EXISTENTES
// ========================================

export const SYSTEM_HELPERS = {
  // Para isSystemCriticalPermission (domain-validation.service.ts línea 269)
  isSystemCriticalPermission: (resource: string, action: string): boolean => {
    const lowerAction = action.toLowerCase();
    const lowerResource = resource.toLowerCase();

    return (
      VALIDATION_CRITICAL_ACTIONS.some(criticalAction => criticalAction === lowerAction) ||
      VALIDATION_CRITICAL_RESOURCES.some(criticalResource => criticalResource === lowerResource)
    );
  },

  // Para hasSystemOrAuditPermissions (domain-validation.service.ts línea 316)
  isSystemOrAuditResource: (resource: string): boolean => {
    const lowercaseResource = resource.toLowerCase();

    return (
      lowercaseResource === SYSTEM_AUDIT_RESOURCES.SYSTEM ||
      lowercaseResource === SYSTEM_AUDIT_RESOURCES.AUDIT
    );
  },

  // Para hasCommonPatterns (domain-validation.service.ts línea 279)
  hasCommonPatterns: (password: string): boolean => {
    return PASSWORD_COMMON_PATTERNS.some(pattern => pattern.test(password));
  },
} as const;
