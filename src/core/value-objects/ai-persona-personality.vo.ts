import { MultilingualField } from './multilingual-field.vo';
import { InvalidAIPersonaPersonalityException } from '../exceptions/ai-persona.exceptions';

export class AIPersonaPersonality extends MultilingualField {
  private static readonly MAX_WORDS = 3;

  protected validate(value: Record<string, string>): void {
    // Call parent validation first
    super.validate(value);

    // Validate each language value for personality-specific rules
    for (const [lang, text] of Object.entries(value)) {
      const wordCount = text.trim().split(/\s+/).length;
      if (wordCount > AIPersonaPersonality.MAX_WORDS) {
        throw new InvalidAIPersonaPersonalityException(
          `AI Persona personality for language ${lang} cannot exceed ${AIPersonaPersonality.MAX_WORDS} words`,
        );
      }
    }
  }

  public static create(value: Record<string, string>): AIPersonaPersonality {
    return new AIPersonaPersonality(value);
  }

  public static createFromString(text: string, language: string): AIPersonaPersonality {
    const value = { [language]: text.trim() };

    return new AIPersonaPersonality(value);
  }

  public withLanguage(language: string, text: string): AIPersonaPersonality {
    if (!text || text.trim().length === 0) {
      throw new InvalidAIPersonaPersonalityException(
        `Personality for language ${language} cannot be empty`,
      );
    }

    const newValue = {
      ...this.getValue(),
      [language]: text.trim(),
    };

    return new AIPersonaPersonality(newValue);
  }
}
