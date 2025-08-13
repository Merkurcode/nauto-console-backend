import { ValueObject } from './value-object';
import { InvalidAIPersonaNameException } from '../exceptions/ai-persona.exceptions';

export class AIPersonaName extends ValueObject<string> {
  private static readonly MAX_LENGTH = 10;

  protected validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new InvalidAIPersonaNameException('AI Persona name cannot be empty');
    }

    if (value.length > AIPersonaName.MAX_LENGTH) {
      throw new InvalidAIPersonaNameException(
        `AI Persona name cannot exceed ${AIPersonaName.MAX_LENGTH} characters`,
      );
    }
  }

  public static create(value: string): AIPersonaName {
    return new AIPersonaName(value.trim());
  }

  public static fromString(value: string): AIPersonaName {
    return new AIPersonaName(value.trim());
  }
}
