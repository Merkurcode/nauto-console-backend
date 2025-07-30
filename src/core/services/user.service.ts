/* eslint-disable prettier/prettier */
import * as bcrypt from 'bcrypt';
import { Injectable, Inject } from '@nestjs/common';
import { USER_REPOSITORY, ROLE_REPOSITORY } from '@shared/constants/tokens';
import { User } from '../entities/user.entity';
import { IUserRepository } from '../repositories/user.repository.interface';
import { IRoleRepository } from '../repositories/role.repository.interface';
import {
  EntityNotFoundException,
  EntityAlreadyExistsException,
  AuthenticationException,
} from '@core/exceptions/domain-exceptions';
import { Email } from '@core/value-objects/email.vo';
import { Password } from '@core/value-objects/password.vo';
import { FirstName, LastName } from '@core/value-objects/name.vo';
import { SecondLastName } from '@core/value-objects/second-lastname.vo';
import { AgentPhone } from '@core/value-objects/agent-phone.vo';
import { UserProfile } from '@core/value-objects/user-profile.vo';
import { Address } from '@core/value-objects/address.vo';
import { RoleId } from '@core/value-objects/role-id.vo';
import { DomainValidationService } from './domain-validation.service';
import { PasswordGenerator } from '@shared/utils/password-generator';
import { EmailService } from './email.service';
import { EmailProvider } from '@presentation/modules/auth/providers/email.provider';
import { SmsService } from './sms.service';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@infrastructure/logger/logger.service';

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
    private readonly domainValidationService: DomainValidationService,
    private readonly emailService: EmailService,
    private readonly emailProvider: EmailProvider,
    private readonly smsService: SmsService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(UserService.name);
  }

  async createUser(
    emailStr: string,
    passwordStr: string | undefined,
    firstName: string,
    lastName: string,
  ): Promise<User> {
    // Validate email using value object
    const email = new Email(emailStr);

    // Generate password if not provided
    let actualPassword = passwordStr;

    if (!passwordStr) {
      actualPassword = PasswordGenerator.generateSecurePassword();
    }

    // Validate password using value object
    const password = new Password(actualPassword!);

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(email.getValue());
    if (existingUser) {
      throw new EntityAlreadyExistsException('User', 'email');
    }

    // Hash the password
    const passwordHash = await this.hashPassword(password.getValue());

    // Create a new user with value objects for name
    const user = User.create(email, passwordHash, new FirstName(firstName), new LastName(lastName));

    // Mark email as verified (removing email verification requirement)
    user.markEmailAsVerified();

    // Assign default role
    const defaultRole = await this.roleRepository.findDefaultRole();
    if (defaultRole) {
      user.addRole(defaultRole);
    }

    // Save the user
    const savedUser = await this.userRepository.create(user);

    // Send welcome email with password
    try {
      const roleNames = user.roles?.map(role => role.name) || [];
      console.log('Enviando correo de bienvenida a:', emailStr, 'con roles:', roleNames);
      await this.emailProvider.sendWelcomeEmailWithPassword(emailStr, firstName, actualPassword!, undefined, roleNames);
    } catch (error) {
      console.error('Error sending welcome email:', error);
      // Continue even if email sending fails
    }

    // Send welcome SMS if user has phone number
    try {
      if (savedUser.profile?.phone) {
        console.log('Enviando SMS de bienvenida al teléfono:', savedUser.profile.phone);
        const frontendUrl = this.configService.get('frontend.url', 'http://localhost:3000');
        const dashboardPath = this.configService.get('frontend.dashboardPath', '/dashboard');
        const dashboardUrl = `${frontendUrl}${dashboardPath}`;
        
        await this.smsService.sendWelcomeSms(
          savedUser.profile.phone, 
          firstName, 
          actualPassword!, 
          dashboardUrl,
          savedUser.id.getValue()
        );
      }
    } catch (error) {
      console.error('Error sending welcome SMS:', error);
      // Continue even if SMS sending fails
    }

    return savedUser;
  }

  async createUserWithExtendedData(
    emailStr: string,
    passwordStr: string | undefined,
    firstName: string,
    lastName: string,
    options?: {
      secondLastName?: string;
      isActive?: boolean;
      emailVerified?: boolean;
      bannedUntil?: Date;
      banReason?: string;
      agentPhone?: string;
      profile?: {
        phone?: string;
        avatarUrl?: string;
        bio?: string;
        birthDate?: string;
      };
      address?: {
        country?: string;
        state?: string;
        city?: string;
        street?: string;
        exteriorNumber?: string;
        interiorNumber?: string;
        postalCode?: string;
      };
      companyName?: string;
      roles?: string[];
    },
  ): Promise<User> {
    // Validate email using value object
    const email = new Email(emailStr);

    // Generate password if not provided
    let actualPassword = passwordStr;

    if (!passwordStr) {
      actualPassword = PasswordGenerator.generateSecurePassword();
    }

    // Validate password using value object
    const password = new Password(actualPassword!);

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(email.getValue());
    if (existingUser) {
      throw new EntityAlreadyExistsException('User', 'email');
    }

    // Hash the password
    const passwordHash = await this.hashPassword(password.getValue());

    // Create value objects for optional fields
    const secondLastNameVO = options?.secondLastName
      ? new SecondLastName(options.secondLastName)
      : undefined;
    const agentPhoneVO = options?.agentPhone ? new AgentPhone(options.agentPhone) : undefined;
    const profileVO = options?.profile
      ? new UserProfile(
          options.profile.phone,
          options.profile.avatarUrl,
          options.profile.bio,
          options.profile.birthDate,
        )
      : undefined;

    let addressVO: Address | undefined;
    if (
      options?.address &&
      options.address.country &&
      options.address.state &&
      options.address.city &&
      options.address.street &&
      options.address.exteriorNumber &&
      options.address.postalCode
    ) {
      addressVO = new Address(
        options.address.country,
        options.address.state,
        options.address.city,
        options.address.street,
        options.address.exteriorNumber,
        options.address.postalCode,
        options.address.interiorNumber,
      );
    }

    // Create a new user with extended data
    const user = User.createWithExtendedData(
      email,
      passwordHash,
      new FirstName(firstName),
      new LastName(lastName),
      {
        secondLastName: secondLastNameVO,
        isActive: options?.isActive ?? true,
        emailVerified: options?.emailVerified ?? false,
        bannedUntil: options?.bannedUntil,
        banReason: options?.banReason,
        agentPhone: agentPhoneVO,
        profile: profileVO,
        address: addressVO,
      },
    );

    // Assign roles if provided, otherwise use default role
    if (options?.roles && options.roles.length > 0) {
      for (const roleName of options.roles) {
        const role = await this.roleRepository.findByName(roleName);
        if (role) {
          user.addRole(role);
        }
      }
    } else {
      // Assign default role if no roles provided
      const defaultRole = await this.roleRepository.findDefaultRole();
      if (defaultRole) {
        user.addRole(defaultRole);
      }
    }

    // Save the user
    const savedUser = await this.userRepository.create(user);

    // Send welcome email with password
    try {
      const roleNames = user.roles?.map(role => role.name) || [];
      console.log('Enviando correo de bienvenida a:', emailStr, 'con roles:', roleNames, 'y compañía:', options?.companyName);
      await this.emailProvider.sendWelcomeEmailWithPassword(emailStr, firstName, actualPassword!, options?.companyName, roleNames);
    } catch (error) {
      console.error('Error sending welcome email:', error);
      // Continue even if email sending fails
    }

    // Send welcome SMS if user has phone number
    try {
      if (savedUser.profile?.phone) {
        console.log('Enviando SMS de bienvenida al teléfono:', savedUser.profile.phone);
        const frontendUrl = this.configService.get('frontend.url', 'http://localhost:3000');
        const dashboardPath = this.configService.get('frontend.dashboardPath', '/dashboard');
        const dashboardUrl = `${frontendUrl}${dashboardPath}`;
        
        await this.smsService.sendWelcomeSms(
          savedUser.profile.phone, 
          firstName, 
          actualPassword!, 
          dashboardUrl,
          savedUser.id.getValue()
        );
      } else {
        console.log('Usuario no tiene teléfono configurado, omitiendo SMS de bienvenida');
      }
    } catch (error) {
      console.error('Error sending welcome SMS:', error);
      // Continue even if SMS sending fails
    }

    return savedUser;
  }

  async validateCredentials(emailStr: string, passwordStr: string): Promise<User | null> {
    try {
      // Validate email format
      const email = new Email(emailStr);

      const user = await this.userRepository.findByEmail(email.getValue());
      if (!user || !user.isActive) {
        return null;
      }

      const isPasswordValid = await this.comparePasswords(passwordStr, user.passwordHash);
      if (!isPasswordValid) {
        return null;
      }

      return user;
    } catch (error) {
      if (error instanceof EntityNotFoundException) {
        // Handle user not found error
        return null;
      }

      // If email is invalid, return null instead of throwing
      return null;
    }
  }

  async updateUserDetails(
    userId: string,
    firstName?: string,
    lastName?: string,
    emailStr?: string,
  ): Promise<User> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new EntityNotFoundException('User', userId);
    }

    // Update profile with new names if provided
    user.updateProfile(
      firstName ? new FirstName(firstName) : undefined,
      lastName ? new LastName(lastName) : undefined,
    );

    if (emailStr) {
      // Validate email using value object
      const email = new Email(emailStr);

      // Check if email is already in use by another user
      const existingUser = await this.userRepository.findByEmail(email.getValue());
      // If the email is already in use, check if it's the same user
      if (existingUser && existingUser.id.getValue() !== userId) {
        throw new EntityAlreadyExistsException('User', 'email');
      }

      user.changeEmail(email);
    }

    // Entity handles updating timestamps

    return this.userRepository.update(user);
  }

  async verifyCurrentPassword(userId: string, currentPassword: string): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new EntityNotFoundException('User', userId);
    }

    return this.comparePasswords(currentPassword, user.passwordHash);
  }

  async changePassword(
    userId: string,
    newPasswordStr: string,
    currentPassword?: string,
  ): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new EntityNotFoundException('User', userId);
    }

    // If current password is provided, verify it
    if (currentPassword) {
      const isCurrentPasswordValid = await this.comparePasswords(
        currentPassword,
        user.passwordHash,
      );

      if (!isCurrentPasswordValid) {
        throw new AuthenticationException('Current password is incorrect');
      }
    }

    // Validate password complexity using domain validation service
    const passwordValidation =
      this.domainValidationService.validatePasswordComplexity(newPasswordStr);
    passwordValidation.throwIfInvalid();

    // Validate new password using value object
    const newPassword = new Password(newPasswordStr);

    user.changePassword(await this.hashPassword(newPassword.getValue()));
    // Entity handles updating timestamps

    return this.userRepository.update(user);
  }

  async assignRoleToUser(
    userId: string,
    roleId: string,
    companyId?: string,
    assigningUserId?: string,
  ): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new EntityNotFoundException('User', userId);
    }

    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new EntityNotFoundException('Role', roleId);
    }

    // Get assigning user if provided
    let assigningUser: User | undefined;
    if (assigningUserId) {
      assigningUser = await this.userRepository.findById(assigningUserId);
    }

    // Validate role assignment using domain validation service
    const roleAssignmentValidation = this.domainValidationService.validateRoleAssignment(
      user,
      role,
      assigningUser,
    );
    roleAssignmentValidation.throwIfInvalid();

    user.addRole(role);

    return this.userRepository.update(user);
  }

  async removeRoleFromUser(userId: string, roleId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new EntityNotFoundException('User', userId);
    }

    user.removeRole(RoleId.fromString(roleId));

    return this.userRepository.update(user);
  }

  async activateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new EntityNotFoundException('User', userId);
    }

    user.activate();

    return this.userRepository.update(user);
  }

  async deactivateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new EntityNotFoundException('User', userId);
    }

    user.deactivate();

    return this.userRepository.update(user);
  }

  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);

    return bcrypt.hash(password, salt);
  }

  private async comparePasswords(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}
