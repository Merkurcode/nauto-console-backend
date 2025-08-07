import { v4 as uuidv4 } from 'uuid';
import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

/**
 * Value Object para identificadores únicos de AuditLog
 *
 * **Propósito**: Proporciona identificación única y tipado fuerte para entidades
 * de audit log, garantizando integridad referencial y validación de formato.
 *
 * **Características**:
 * - Inmutable después de creación
 * - Validación automática de formato UUID v4
 * - Métodos de comparación y conversión
 * - Type safety en toda la aplicación
 *
 * **Arquitectura**: Siguiendo DDD Value Objects pattern
 * - Sin identidad propia (definido por su valor)
 * - Inmutable y thread-safe
 * - Validación en constructor
 * - Factory methods para diferentes casos de uso
 *
 * @example
 * ```typescript
 * // Generar nuevo ID
 * const id = AuditLogId.generate();
 *
 * // Crear desde string existente
 * const existingId = AuditLogId.fromString('123e4567-e89b-12d3-a456-426614174000');
 *
 * // Comparación
 * if (id1.equals(id2)) {
 *   console.log('Same audit log');
 * }
 *
 * // Obtener valor
 * const stringValue = id.getValue();
 * ```
 *
 * **Validaciones aplicadas**:
 * - Non-null y non-empty string
 * - Formato UUID v4 válido
 * - Case-insensitive matching
 */
export class AuditLogId {
  private constructor(private readonly value: string) {
    this.validate(value);
  }

  /**
   * Genera un nuevo AuditLogId único
   *
   * **Propósito**: Factory method para crear nuevos identificadores únicos
   * usando UUID v4 para garantizar unicidad global.
   *
   * @returns Nueva instancia de AuditLogId con UUID v4 generado
   */
  static generate(): AuditLogId {
    return new AuditLogId(uuidv4());
  }

  /**
   * Crea AuditLogId desde string existente
   *
   * **Propósito**: Factory method para reconstituir AuditLogId desde
   * representación string (ej. desde base de datos, APIs).
   *
   * @param value - String UUID v4 válido
   * @returns Instancia de AuditLogId validada
   * @throws InvalidValueObjectException si el formato es inválido
   */
  static fromString(value: string): AuditLogId {
    return new AuditLogId(value);
  }

  /**
   * Valida formato UUID v4 del identificador
   *
   * **Validaciones**:
   * - Non-null y non-empty string
   * - Formato UUID v4 exacto (8-4-4-4-12 caracteres hexadecimales)
   * - Versión 4 (character 14 debe ser '4')
   * - Variant bits correctos (character 19 debe ser 8, 9, A, o B)
   *
   * @param value - Valor a validar
   * @throws InvalidValueObjectException si la validación falla
   */
  private validate(value: string): void {
    if (!value || typeof value !== 'string') {
      throw new InvalidValueObjectException('AuditLogId must be a non-empty string', 'AuditLogId');
    }

    // UUID v4 validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new InvalidValueObjectException('AuditLogId must be a valid UUID', 'AuditLogId');
    }
  }

  /**
   * Obtiene el valor string del identificador
   *
   * @returns String UUID v4 del identificador
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Compara igualdad con otro AuditLogId
   *
   * **Propósito**: Implementa comparación por valor para Value Objects,
   * esencial para operaciones de búsqueda y comparación en colecciones.
   *
   * @param other - Otro AuditLogId para comparar
   * @returns true si ambos tienen el mismo valor UUID
   */
  equals(other: AuditLogId): boolean {
    return other instanceof AuditLogId && this.value === other.value;
  }

  /**
   * Representación string del identificador
   *
   * @returns String UUID v4 para serialización y logging
   */
  toString(): string {
    return this.value;
  }
}
