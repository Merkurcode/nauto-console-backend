import { ValueObject } from './value-object';
import { InvalidAIPersonaKeyNameException } from '../exceptions/ai-persona.exceptions';

export class AIPersonaKeyName extends ValueObject<string> {
  private static readonly MAX_LENGTH = 10; // Same as name since it's derived from it

  protected validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new InvalidAIPersonaKeyNameException('AI Persona key name cannot be empty');
    }

    if (value.length > AIPersonaKeyName.MAX_LENGTH) {
      throw new InvalidAIPersonaKeyNameException(
        `AI Persona key name cannot exceed ${AIPersonaKeyName.MAX_LENGTH} characters`,
      );
    }

    // KeyName should be in normalized format (lowercase, underscores, no special chars)
    const validFormat = /^[a-z0-9_]+$/;
    if (!validFormat.test(value)) {
      throw new InvalidAIPersonaKeyNameException(
        'AI Persona key name must be lowercase with only letters, numbers, and underscores',
      );
    }
  }

  public static create(value: string): AIPersonaKeyName {
    return new AIPersonaKeyName(value);
  }

  public static fromString(value: string): AIPersonaKeyName {
    return new AIPersonaKeyName(value);
  }

  public static fromName(name: string): AIPersonaKeyName {
    const normalized = AIPersonaKeyName.normalize(name);

    return new AIPersonaKeyName(normalized);
  }

  private static normalize(value: string): string {
    return (
      value
        .toLowerCase()
        .trim()
        // Remove accents
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        // Replace multiple spaces with single space
        .replace(/\s+/g, ' ')
        // Replace spaces with underscores
        .replace(/\s/g, '_')
        // Remove special characters
        .replace(/[^a-z0-9_]/g, '')
    );
  }
}
