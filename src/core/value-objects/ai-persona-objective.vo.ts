import { MultilingualField } from './multilingual-field.vo';
import { InvalidAIPersonaObjectiveException } from '../exceptions/ai-persona.exceptions';

export class AIPersonaObjective extends MultilingualField {
  private static readonly MAX_LENGTH = 100;

  protected validate(value: Record<string, string>): void {
    // Call parent validation first
    super.validate(value);

    // Validate each language value for objective-specific rules
    for (const [lang, text] of Object.entries(value)) {
      if (text.length > AIPersonaObjective.MAX_LENGTH) {
        throw new InvalidAIPersonaObjectiveException(
          `AI Persona objective for language ${lang} cannot exceed ${AIPersonaObjective.MAX_LENGTH} characters`,
        );
      }
    }
  }

  public static create(value: Record<string, string>): AIPersonaObjective {
    return new AIPersonaObjective(value);
  }

  public static createFromString(text: string, language: string): AIPersonaObjective {
    const value = { [language]: text.trim() };

    return new AIPersonaObjective(value);
  }

  public withLanguage(language: string, text: string): AIPersonaObjective {
    if (!text || text.trim().length === 0) {
      throw new InvalidAIPersonaObjectiveException(
        `Objective for language ${language} cannot be empty`,
      );
    }

    const newValue = {
      ...this.getValue(),
      [language]: text.trim(),
    };

    return new AIPersonaObjective(newValue);
  }
}
