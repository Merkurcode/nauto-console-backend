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
import { RoleId } from '@core/value-objects/role-id.vo';
import { DomainValidationService } from './domain-validation.service';
import { PasswordGenerator } from '@shared/utils/password-generator';
import { EmailProvider } from '@presentation/modules/auth/providers/email.provider';
import { EmailTemplates } from '@shared/services/email/email-templates';

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
    private readonly domainValidationService: DomainValidationService,
    private readonly emailProvider: EmailProvider,
  ) {}

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
    let passwordWasGenerated = false;

    if (!passwordStr) {
      actualPassword = PasswordGenerator.generateSecurePassword();
      passwordWasGenerated = true;
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

    // Send welcome email if password was generated
    if (passwordWasGenerated) {
      try {
        await this.emailProvider.sendWelcomeEmail(emailStr, firstName);
      } catch (error) {
        console.error('Error sending welcome email:', error);
        // Continue even if email sending fails
      }
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

  private async sendWelcomeEmail(
    email: string,
    firstName: string,
    password: string,
    companyId?: string,
  ): Promise<void> {
    let companyName: string | undefined;

    // Get company name if companyId is provided
    if (companyId) {
      try {
        // Note: We would need to inject the company repository to get the company name
        // For now, we'll use a placeholder
        companyName = 'Mi Empresa'; // TODO: Get actual company name from repository
      } catch (error) {
        console.error('Error fetching company name:', error);
      }
    }

    const htmlContent = EmailTemplates.welcomeWithPassword(firstName, email, password, companyName);

    await this.emailProvider.sendEmail(
      email,
      'Bienvenido a la plataforma - Tus credenciales de acceso',
      htmlContent,
      true, // isHtml
    );
  }
}
