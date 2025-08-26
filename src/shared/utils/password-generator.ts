import { randomBytes } from 'crypto';

export class PasswordGenerator {
  private static readonly LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
  private static readonly UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  private static readonly NUMBERS = '0123456789';
  private static readonly SYMBOLS = '!@#$%^&*()_+-=[]';

  /**
   * Generates a random password that meets the application's requirements
   * - At least 8 characters long
   * - Contains at least one uppercase letter
   * - Contains at least one lowercase letter
   * - Contains at least one number
   * - Contains at least one special character
   */
  static generateSecurePassword(length: number = 12): string {
    if (length < 8) {
      throw new Error('Password length must be at least 8 characters');
    }

    const allCharacters = this.LOWERCASE + this.UPPERCASE + this.NUMBERS + this.SYMBOLS;
    let password = '';

    // Ensure at least one character from each required category
    password += this.getRandomChar(this.LOWERCASE);
    password += this.getRandomChar(this.UPPERCASE);
    password += this.getRandomChar(this.NUMBERS);
    password += this.getRandomChar(this.SYMBOLS);

    // Fill the rest with random characters
    for (let i = password.length; i < length; i++) {
      password += this.getRandomChar(allCharacters);
    }

    // Shuffle the password to avoid predictable patterns
    return this.shuffleString(password);
  }

  private static getRandomChar(charset: string): string {
    const randomIndex = randomBytes(1)[0] % charset.length;

    return charset[randomIndex];
  }

  private static shuffleString(str: string): string {
    const array = str.split('');
    for (let i = array.length - 1; i > 0; i--) {
      const j = randomBytes(1)[0] % (i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }

    return array.join('');
  }
}
