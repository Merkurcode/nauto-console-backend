import { ValueObject } from './value-object';
import { InvalidMultilingualFieldException } from '../exceptions/domain-exceptions';

/**
 * Generic multilingual field value object
 * Handles JSON objects with language keys like {"es-MX": "value", "en-US": "value", "fr-FR": "value"}
 * Can be used for any field that needs multilingual support across the entire system
 */
export class MultilingualField extends ValueObject<Record<string, string>> {
  protected validate(value: Record<string, string>): void {
    if (!value || typeof value !== 'object') {
      throw new InvalidMultilingualFieldException('Value must be an object with language keys');
    }

    const languages = Object.keys(value);
    if (languages.length === 0) {
      throw new InvalidMultilingualFieldException('At least one language must be provided');
    }

    // Validate each language value
    for (const lang of languages) {
      const langValue = value[lang];
      if (!langValue || typeof langValue !== 'string' || langValue.trim().length === 0) {
        throw new InvalidMultilingualFieldException(
          `Value for language ${lang} cannot be empty`,
          lang,
        );
      }
    }
  }

  /**
   * Get value for a specific language, fallback to first available language
   */
  public getForLanguage(language: string): string {
    const value = this.getValue();

    return value[language] || Object.values(value)[0];
  }

  /**
   * Get all available languages
   */
  public getAvailableLanguages(): string[] {
    return Object.keys(this.getValue());
  }

  /**
   * Add or update a language
   */
  public withLanguage(language: string, text: string): MultilingualField {
    if (!text || text.trim().length === 0) {
      throw new InvalidMultilingualFieldException(
        `Value for language ${language} cannot be empty`,
        language,
      );
    }

    const newValue = {
      ...this.getValue(),
      [language]: text.trim(),
    };

    return new MultilingualField(newValue);
  }

  /**
   * Create from single language value
   */
  public static createFromString(text: string, language: string): MultilingualField {
    const value = { [language]: text.trim() };

    return new MultilingualField(value);
  }

  /**
   * Create from multilingual object
   */
  public static create(value: Record<string, string>): MultilingualField {
    return new MultilingualField(value);
  }

  /**
   * Create empty instance
   */
  public static empty(): MultilingualField {
    return new MultilingualField({});
  }
}
