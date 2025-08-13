import { MultilingualField } from './multilingual-field.vo';
import { InvalidAIPersonaShortDetailsException } from '../exceptions/ai-persona.exceptions';

export class AIPersonaShortDetails extends MultilingualField {
  private static readonly MAX_LENGTH = 75;

  protected validate(value: Record<string, string>): void {
    // Call parent validation first
    super.validate(value);

    // Validate each language value for short details specific rules
    for (const [lang, text] of Object.entries(value)) {
      if (text.length > AIPersonaShortDetails.MAX_LENGTH) {
        throw new InvalidAIPersonaShortDetailsException(
          `AI Persona short details for language ${lang} cannot exceed ${AIPersonaShortDetails.MAX_LENGTH} characters`,
        );
      }
    }
  }

  public static create(value: Record<string, string>): AIPersonaShortDetails {
    return new AIPersonaShortDetails(value);
  }

  public static createFromString(text: string, language: string): AIPersonaShortDetails {
    const value = { [language]: text.trim() };

    return new AIPersonaShortDetails(value);
  }

  public withLanguage(language: string, text: string): AIPersonaShortDetails {
    if (!text || text.trim().length === 0) {
      throw new InvalidAIPersonaShortDetailsException(
        `Short details for language ${language} cannot be empty`,
      );
    }

    const newValue = {
      ...this.getValue(),
      [language]: text.trim(),
    };

    return new AIPersonaShortDetails(newValue);
  }
}
