import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ForbiddenActionException,
  EntityNotFoundException,
} from '@core/exceptions/domain-exceptions';
import { RolesEnum } from '@shared/constants/enums';
import { Email } from '@core/value-objects/email.vo';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE, USER_REPOSITORY } from '@shared/constants/tokens';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { User } from '@core/entities/user.entity';
import { UserService } from './user.service';

/**
 * Domain Service para lógica de negocio de tokens BOT
 * Maneja reglas de negocio y validaciones de dominio
 */
@Injectable()
export class BotTokenService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
    private readonly userService: UserService,
  ) {
    this.logger.setContext(BotTokenService.name);
  }

  /**
   * Valida que un usuario puede generar tokens BOT
   * Regla de negocio: Solo usuarios ROOT pueden generar tokens BOT
   */
  async validateBotTokenGeneration(
    requestingUserId: string,
    botUserId: string,
    botEmail: string,
  ): Promise<{
    requestingUser: User;
    botUser: User | null;
  }> {
    // Obtener usuario solicitante
    const requestingUser = await this.userRepository.findById(requestingUserId);
    if (!requestingUser) {
      throw new EntityNotFoundException('User', requestingUserId);
    }

    // Validar que el usuario sea ROOT
    if (!this.isUserRoot(requestingUser)) {
      this.logger.warn({
        message: 'Non-ROOT user attempted to generate BOT token',
        userId: requestingUserId,
        userRoles: requestingUser.roles.map(r => r.name),
      });
      throw new ForbiddenActionException('Only ROOT users can generate BOT tokens');
    }

    // Validar email
    const emailVO = new Email(botEmail);

    // Verificar si el usuario BOT ya existe
    let botUser = await this.userRepository.findById(botUserId);

    // Si no existe, verificar por email
    if (!botUser) {
      botUser = await this.userRepository.findByEmail(emailVO.getValue());
    }

    // Validar que si existe, tenga rol BOT
    if (botUser && !this.isUserBot(botUser)) {
      throw new ForbiddenActionException('Target user must have BOT role to generate BOT tokens');
    }

    this.logger.debug({
      message: 'BOT token generation validated',
      requestingUserId,
      botUserId,
      botEmail: emailVO.getValue(),
    });

    return {
      requestingUser,
      botUser,
    };
  }

  /**
   * Validates BOT token generation by alias and password
   * Authenticates the bot user and validates that requesting user is ROOT
   */
  async validateBotTokenGenerationByAlias(
    requestingUserId: string,
    botAlias: string,
    password: string,
  ): Promise<{
    requestingUser: User;
    botUser: User;
  }> {
    // Get requesting user
    const requestingUser = await this.userRepository.findById(requestingUserId);
    if (!requestingUser) {
      throw new EntityNotFoundException('User', requestingUserId);
    }

    // Validate requesting user is ROOT
    if (!this.isUserRoot(requestingUser)) {
      this.logger.warn({
        message: 'Non-ROOT user attempted to generate BOT token by alias',
        userId: requestingUserId,
        userRoles: requestingUser.roles.map(r => r.name),
        botAlias,
      });
      throw new ForbiddenActionException('Only ROOT users can generate BOT tokens');
    }

    // Find BOT user by alias
    const botUser = await this.userRepository.findByAlias(botAlias);
    if (!botUser) {
      this.logger.warn({
        message: 'BOT token generation attempted with non-existent alias',
        requestingUserId,
        botAlias,
      });
      throw new EntityNotFoundException('Bot User', `alias: ${botAlias}`);
    }

    // Validate that target user has BOT role (if using roles for bots)
    if (!this.isUserBot(botUser)) {
      throw new ForbiddenActionException('Target user must have BOT role to generate BOT tokens');
    }

    // Validate password using email/password validation
    const credentialsResult = await this.userService.validateCredentials(
      botUser.email.getValue(),
      password,
    );

    if (!credentialsResult.success) {
      this.logger.warn({
        message: 'BOT token generation attempted with invalid credentials',
        requestingUserId,
        botAlias,
        botUserId: botUser.id.getValue(),
        failureReason: credentialsResult.failureReason,
      });
      throw new ForbiddenActionException('Invalid credentials for BOT user');
    }

    this.logger.debug({
      message: 'BOT token generation by alias validated successfully',
      requestingUserId,
      botAlias,
      botUserId: botUser.id.getValue(),
      companyId: botUser.companyId?.getValue(),
    });

    return {
      requestingUser,
      botUser,
    };
  }

  /**
   * Valida que un usuario puede revocar tokens BOT
   */
  async validateBotTokenRevocation(requestingUserId: string, tokenId: string): Promise<User> {
    const requestingUser = await this.userRepository.findById(requestingUserId);
    if (!requestingUser) {
      throw new EntityNotFoundException('User', requestingUserId);
    }

    if (!this.isUserRoot(requestingUser)) {
      throw new ForbiddenActionException('Only ROOT users can revoke BOT tokens');
    }

    this.logger.debug({
      message: 'BOT token revocation validated',
      requestingUserId,
      tokenId,
    });

    return requestingUser;
  }

  /**
   * Valida que un usuario puede listar tokens BOT
   */
  async validateBotTokenListing(requestingUserId: string): Promise<User> {
    const requestingUser = await this.userRepository.findById(requestingUserId);
    if (!requestingUser) {
      throw new EntityNotFoundException('User', requestingUserId);
    }

    if (!this.isUserRoot(requestingUser)) {
      throw new ForbiddenActionException('Only ROOT users can list BOT tokens');
    }

    return requestingUser;
  }

  /**
   * Genera un ID único para el token usando UUID v4
   * Más seguro que timestamp + random ya que no revela información temporal
   */
  generateTokenId(): string {
    return randomUUID();
  }

  /**
   * Verifica si un usuario tiene rol ROOT
   */
  private isUserRoot(user: User): boolean {
    return user.rolesCollection.containsByName(RolesEnum.ROOT);
  }

  /**
   * Verifica si un usuario tiene rol BOT
   */
  private isUserBot(user: User): boolean {
    return user.rolesCollection.containsByName(RolesEnum.BOT);
  }
}
