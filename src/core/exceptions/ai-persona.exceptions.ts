import { DomainException } from '@core/exceptions/domain-exceptions';

/**
 * AI Persona domain exception hierarchy
 * Base class for all AI Persona-related exceptions
 */
export abstract class AIPersonaDomainException extends DomainException {}

export class AIPersonaNotFoundException extends AIPersonaDomainException {
  constructor(id: string) {
    super(`AI Persona with id ${id} not found`, 'AI_PERSONA_NOT_FOUND', { id });
  }
}

export class AIPersonaKeyNameAlreadyExistsException extends AIPersonaDomainException {
  constructor(keyName: string, companyId?: string | null) {
    const context = companyId ? `company ${companyId}` : 'default AI personas';
    super(
      `AI Persona with key name '${keyName}' already exists in ${context}`,
      'AI_PERSONA_KEY_NAME_ALREADY_EXISTS',
      { keyName, companyId },
    );
  }
}

export class InvalidAIPersonaNameException extends AIPersonaDomainException {
  constructor(message: string) {
    super(message, 'INVALID_AI_PERSONA_NAME');
  }
}

export class InvalidAIPersonaKeyNameException extends AIPersonaDomainException {
  constructor(message: string) {
    super(message, 'INVALID_AI_PERSONA_KEY_NAME');
  }
}

export class InvalidAIPersonaToneException extends AIPersonaDomainException {
  constructor(message: string) {
    super(message, 'INVALID_AI_PERSONA_TONE');
  }
}

export class InvalidAIPersonaPersonalityException extends AIPersonaDomainException {
  constructor(message: string) {
    super(message, 'INVALID_AI_PERSONA_PERSONALITY');
  }
}

export class InvalidAIPersonaObjectiveException extends AIPersonaDomainException {
  constructor(message: string) {
    super(message, 'INVALID_AI_PERSONA_OBJECTIVE');
  }
}

export class InvalidAIPersonaShortDetailsException extends AIPersonaDomainException {
  constructor(message: string) {
    super(message, 'INVALID_AI_PERSONA_SHORT_DETAILS');
  }
}

export class UnauthorizedAIPersonaModificationException extends AIPersonaDomainException {
  constructor(userId: string, aiPersonaId: string) {
    super(
      `User ${userId} is not authorized to modify AI Persona ${aiPersonaId}`,
      'UNAUTHORIZED_AI_PERSONA_MODIFICATION',
      { userId, aiPersonaId },
    );
  }
}

export class CompanyAlreadyHasActiveAIPersonaException extends AIPersonaDomainException {
  constructor(companyId: string) {
    super(
      `Company ${companyId} already has an active AI Persona assigned`,
      'COMPANY_ALREADY_HAS_ACTIVE_AI_PERSONA',
      { companyId },
    );
  }
}

export class CannotModifyDefaultAIPersonaException extends AIPersonaDomainException {
  constructor(message: string = 'Only root users can modify default AI personas') {
    super(message, 'CANNOT_MODIFY_DEFAULT_AI_PERSONA');
  }
}

export class CannotDeleteDefaultAIPersonaException extends AIPersonaDomainException {
  constructor() {
    super('Cannot delete default AI personas', 'CANNOT_DELETE_DEFAULT_AI_PERSONA');
  }
}

// ✅ REUTILIZAR: Usar la excepción común InsufficientPermissionsException
// No crear una específica para AI Persona - la común cubre este caso

export class AIPersonaCompanyAssignmentRemovalException extends AIPersonaDomainException {
  constructor(aiPersonaId: string, error: string) {
    super(
      `Failed to remove company assignments for AI Persona ${aiPersonaId}: ${error}`,
      'AI_PERSONA_COMPANY_ASSIGNMENT_REMOVAL_FAILED',
      { aiPersonaId, error },
    );
  }
}
