import { MultilingualField } from './multilingual-field.vo';
import { InvalidAIPersonaToneException } from '../exceptions/ai-persona.exceptions';

export class AIPersonaTone extends MultilingualField {
  private static readonly MAX_LENGTH = 255;
  private static readonly MAX_WORDS = 3;

  protected validate(value: Record<string, string>): void {
    // Call parent validation first
    super.validate(value);

    // Validate each language value for tone-specific rules
    for (const [lang, text] of Object.entries(value)) {
      if (text.length > AIPersonaTone.MAX_LENGTH) {
        throw new InvalidAIPersonaToneException(
          `AI Persona tone for language ${lang} cannot exceed ${AIPersonaTone.MAX_LENGTH} characters`,
        );
      }

      const wordCount = text.trim().split(/\s+/).length;
      if (wordCount > AIPersonaTone.MAX_WORDS) {
        throw new InvalidAIPersonaToneException(
          `AI Persona tone for language ${lang} cannot exceed ${AIPersonaTone.MAX_WORDS} words`,
        );
      }
    }
  }

  public static create(value: Record<string, string>): AIPersonaTone {
    return new AIPersonaTone(value);
  }

  public static createFromString(text: string, language: string): AIPersonaTone {
    const value = { [language]: text.trim() };

    return new AIPersonaTone(value);
  }

  public withLanguage(language: string, text: string): AIPersonaTone {
    if (!text || text.trim().length === 0) {
      throw new InvalidAIPersonaToneException(`Tone for language ${language} cannot be empty`);
    }

    const newValue = {
      ...this.getValue(),
      [language]: text.trim(),
    };

    return new AIPersonaTone(newValue);
  }
}
