/**
 * Interface for Company AI Configuration JSON structure
 * All fields are optional to allow partial updates
 */
export interface ICompanyConfigAI {
  /**
   * Welcome message displayed to users
   * Maximum length: 3000 characters
   */
  welcomeMessage?: string;

  /**
   * AI model temperature setting (0.0 to 1.0)
   * Controls randomness/creativity of AI responses
   */
  temperature?: number;

  /**
   * Instructions for AI response behavior
   * Maximum length: 3000 characters
   */
  responseInstructions?: string;

  /**
   * Instructions for discovering client needs
   * Maximum length: 3000 characters
   */
  clientDiscoveryInstructions?: string;
}
