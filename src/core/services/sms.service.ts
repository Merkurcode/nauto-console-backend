import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@infrastructure/logger/logger.service';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { USER_REPOSITORY } from '@shared/constants/tokens';

export interface ISmsOptions {
  phoneNumber: string;
  message: string;
  countryCode?: string;
}

@Injectable()
export class SmsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {
    this.logger.setContext(SmsService.name);
  }

  private async getUserCountryPhoneCode(userId: string): Promise<string> {
    try {
      const phoneCode = await this.userRepository.getUserCountryPhoneCode(userId);

      return phoneCode || '52'; // Default to Mexico if not found
    } catch (error) {
      this.logger.warn({
        message: 'Failed to get user country phone code',
        userId,
        error: error.message,
      });

      return '52'; // Default to Mexico
    }
  }

  async sendSms(options: ISmsOptions): Promise<boolean> {
    try {
      const apiKey = this.configService.get<string>('sms.masivos.apiKey');
      const apiUrl = this.configService.get<string>(
        'sms.masivos.apiUrl',
        'https://app.smsmasivos.com.mx/sms/send',
      );

      if (!apiKey) {
        this.logger.warn('SMS_MASIVOS_API_KEY not configured, skipping SMS sending');

        return false;
      }

      // Use provided country code or default to Mexico
      const countryCode = options.countryCode || '52';

      // Clean phone number (remove any non-digit characters except +)
      const cleanPhoneNumber = options.phoneNumber.replace(/[^\d+]/g, '');

      // Prepare form data as per SMS Masivos API documentation
      const formData = new URLSearchParams();
      formData.append('message', options.message);
      formData.append('numbers', cleanPhoneNumber);
      formData.append('country_code', countryCode);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          apikey: apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(
          `SMS Masivos API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const result = await response.text(); // SMS Masivos might return plain text or JSON

      this.logger.log({
        message: 'SMS sent successfully',
        to: options.phoneNumber,
        countryCode,
        response: result,
      });

      return true;
    } catch (error) {
      this.logger.error({
        message: 'Failed to send SMS',
        to: options.phoneNumber,
        countryCode: options.countryCode,
        error: error.message,
      });

      return false;
    }
  }

  async sendVerificationSms(phoneNumber: string, code: string, userId?: string): Promise<boolean> {
    this.logger.debug({
      message: 'sendVerificationSms called',
      phoneNumber,
      codeLength: code?.length,
      userId,
    });

    const message = `Tu código de verificación es: ${code}. Este código expira en 5 minutos. Nauto Console`;

    // Get user's country phone code from database if userId is provided
    let countryCode = '52'; // Default to Mexico
    if (userId) {
      this.logger.debug({
        message: 'Getting country code for verification SMS',
        userId,
      });
      countryCode = await this.getUserCountryPhoneCode(userId);
      this.logger.debug({
        message: 'Country code retrieved for verification SMS',
        userId,
        countryCode,
      });
    }

    this.logger.debug({
      message: 'Calling sendSms for verification',
      phoneNumber,
      messageLength: message?.length,
      countryCode,
    });

    const result = await this.sendSms({
      phoneNumber,
      message,
      countryCode,
    });

    this.logger.debug({
      message: 'Verification SMS result',
      result,
      phoneNumber,
    });

    return result;
  }

  async sendWelcomeSms(
    phoneNumber: string, 
    firstName: string, 
    password: string, 
    dashboardUrl?: string, 
    userId?: string
  ): Promise<boolean> {
    this.logger.debug({
      message: 'sendWelcomeSms called',
      phoneNumber,
      firstName,
      hasDashboardUrl: !!dashboardUrl,
      userId,
    });

    const appName = this.configService.get('APP_NAME', 'Nauto Console');
    const shortUrl = dashboardUrl || 'la plataforma';
    
    const message = `¡Hola ${firstName}! Bienvenido a ${appName}. Tu contraseña es: ${password}. Accede en: ${shortUrl}`;

    // Get user's country phone code from database if userId is provided
    let countryCode = '52'; // Default to Mexico
    if (userId) {
      this.logger.debug({
        message: 'Getting country code for welcome SMS',
        userId,
      });
      countryCode = await this.getUserCountryPhoneCode(userId);
      this.logger.debug({
        message: 'Country code retrieved for welcome SMS',
        userId,
        countryCode,
      });
    }

    this.logger.debug({
      message: 'Calling sendSms for welcome message',
      phoneNumber,
      messageLength: message?.length,
      countryCode,
    });

    const result = await this.sendSms({
      phoneNumber,
      message,
      countryCode,
    });

    this.logger.debug({
      message: 'Welcome SMS result',
      result,
      phoneNumber,
    });

    return result;
  }
}
