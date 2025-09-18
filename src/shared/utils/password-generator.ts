import { randomBytes } from 'crypto';

export class PasswordGenerator {
  private static readonly LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
  private static readonly UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  private static readonly NUMBERS = '0123456789';
  private static readonly SYMBOLS = '!@#$%^*()_+-=[]{}|;:,.';

  /**
   * Validates that a password meets all requirements
   */
  static validatePassword(password: string): boolean {
    if (password.length < 8) return false;

    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^*()_+\-=\[\]{}|;:,.]/.test(password);

    return hasLowercase && hasUppercase && hasNumber && hasSpecial;
  }

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

    let password = '';
    let attempts = 0;
    const maxAttempts = 10;

    do {
      password = '';

      // Ensure at least one character from each required category
      password += this.getRandomChar(this.LOWERCASE);
      password += this.getRandomChar(this.UPPERCASE);
      password += this.getRandomChar(this.NUMBERS);
      password += this.getRandomChar(this.SYMBOLS);

      // Fill the rest with random characters
      const allCharacters = this.LOWERCASE + this.UPPERCASE + this.NUMBERS + this.SYMBOLS;
      for (let i = password.length; i < length; i++) {
        password += this.getRandomChar(allCharacters);
      }

      // Shuffle the password to avoid predictable patterns
      password = this.shuffleString(password);

      attempts++;
      if (attempts >= maxAttempts) {
        throw new Error('Failed to generate a valid password after maximum attempts');
      }
    } while (!this.validatePassword(password));

    return password;
  }

  private static getRandomChar(charset: string): string {
    // Use rejection sampling to avoid modulo bias
    const max = Math.floor(256 / charset.length) * charset.length;
    let randomValue;

    do {
      randomValue = randomBytes(1)[0];
    } while (randomValue >= max);

    const randomIndex = randomValue % charset.length;

    return charset[randomIndex];
  }

  private static shuffleString(str: string): string {
    const array = str.split('');

    // Fisher-Yates shuffle with proper random number generation
    for (let i = array.length - 1; i > 0; i--) {
      // Avoid modulo bias in shuffle
      const max = Math.floor(256 / (i + 1)) * (i + 1);
      let randomValue;

      do {
        randomValue = randomBytes(1)[0];
      } while (randomValue >= max);

      const j = randomValue % (i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }

    return array.join('');
  }
}
