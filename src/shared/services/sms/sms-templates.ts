export class SmsTemplates {
  /**
   * SMS template for verification code
   * @param code Verification code
   * @param appName Application name
   * @returns SMS message string
   */
  static verificationCode(code: string, appName: string = 'Nauto Console'): string {
    return `Tu código de verificación es: ${code}. Este código expira en 5 minutos. ${appName}`;
  }

  /**
   * SMS template for welcome message with password
   * @param firstName User's first name
   * @param appName Application name
   * @param password User's generated password
   * @param dashboardUrl Dashboard URL or fallback text
   * @returns SMS message string
   */
  static welcomeWithPassword(
    firstName: string,
    appName: string,
    password: string,
    dashboardUrl?: string,
  ): string {
    const accessInfo = dashboardUrl || 'la plataforma';
    return `¡Hola ${firstName}! Bienvenido a ${appName}. Tu contraseña es: ${password}. Accede en: ${accessInfo}`;
  }

  /**
   * SMS template for welcome message without password
   * @param firstName User's first name
   * @param appName Application name
   * @param dashboardUrl Dashboard URL or fallback text
   * @returns SMS message string
   */
  static welcome(
    firstName: string,
    appName: string,
    dashboardUrl?: string,
  ): string {
    const accessInfo = dashboardUrl || 'la plataforma';
    return `¡Hola ${firstName}! Bienvenido a ${appName}. Accede en: ${accessInfo}`;
  }

  /**
   * SMS template for password reset notification
   * @param firstName User's first name
   * @param appName Application name
   * @returns SMS message string
   */
  static passwordReset(firstName: string, appName: string): string {
    return `Hola ${firstName}, se ha solicitado restablecer tu contraseña en ${appName}. Revisa tu email para continuar.`;
  }

  /**
   * SMS template for account activation
   * @param firstName User's first name
   * @param appName Application name
   * @returns SMS message string
   */
  static accountActivated(firstName: string, appName: string): string {
    return `¡Hola ${firstName}! Tu cuenta en ${appName} ha sido activada exitosamente.`;
  }

  /**
   * SMS template for security alert
   * @param firstName User's first name
   * @param appName Application name
   * @param action Security action performed
   * @returns SMS message string
   */
  static securityAlert(
    firstName: string,
    appName: string,
    action: string,
  ): string {
    return `Hola ${firstName}, se ha realizado una acción de seguridad en tu cuenta de ${appName}: ${action}. Si no fuiste tú, contacta soporte.`;
  }
}