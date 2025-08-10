/* eslint-disable prettier/prettier */
import * as bcrypt from 'bcrypt';
import { Injectable, Inject } from '@nestjs/common';
import { USER_REPOSITORY, ROLE_REPOSITORY, COMPANY_REPOSITORY, LOGGER_SERVICE } from '@shared/constants/tokens';
import { User } from '../entities/user.entity';
import { IUserRepository } from '../repositories/user.repository.interface';
import { IRoleRepository } from '../repositories/role.repository.interface';
import { ICompanyRepository } from '../repositories/company.repository.interface';
import { CompanyName } from '@core/value-objects/company-name.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import {
  EntityNotFoundException,
  EntityAlreadyExistsException,
  AuthenticationException,
  BusinessRuleValidationException,
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
import { UserAuthorizationService } from './user-authorization.service';
import { PasswordGenerator } from '@shared/utils/password-generator';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { ConfigService } from '@nestjs/config';
import { ILogger } from '@core/interfaces/logger.interface';
import { AuthFailureReason, IAuthValidationResult } from '@shared/constants/auth-failure-reason.enum';

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
    private readonly domainValidationService: DomainValidationService,
    private readonly userAuthorizationService: UserAuthorizationService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly configService: ConfigService,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
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
      this.logger.log({
        message: 'Sending welcome email',
        email: emailStr,
        firstName,
        roles: roleNames,
      });
      await this.emailService.sendWelcomeEmailWithPassword(emailStr, firstName, actualPassword!, undefined, roleNames);
    } catch (error) {
      this.logger.error({
        message: 'Error sending welcome email',
        email: emailStr,
        error: error.message,
      });
      // Continue even if email sending fails
    }

    // Send welcome SMS if user has phone number
    try {
      if (savedUser.profile?.phone) {
        this.logger.log({
          message: 'Sending welcome SMS to user',
          phone: savedUser.profile.phone,
          firstName,
        });
        const frontendUrl = this.configService.get('frontend.url', 'http://localhost:3000');
        const dashboardPath = this.configService.get('frontend.dashboardPath', '/dashboard');
        const dashboardUrl = `${frontendUrl}${dashboardPath}`;

        await this.smsService.sendWelcomeSms(
          savedUser.profile.phone,
          firstName,
          actualPassword!,
          dashboardUrl,
          savedUser.id.getValue(),
        );
      }
    } catch (error) {
      this.logger.error({
        message: 'Error sending welcome SMS',
        phone: savedUser.profile?.phone,
        error: error.message,
      });
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
      agentPhoneCountryCode?: string;
      profile?: {
        phone?: string;
        phoneCountryCode?: string;
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
    const agentPhoneVO = options?.agentPhone ? new AgentPhone(options.agentPhone, options.agentPhoneCountryCode) : undefined;
    const profileVO = options?.profile
      ? new UserProfile(
        options.profile.phone,
        options.profile.phoneCountryCode,
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

    // Handle company assignment if provided
    let companyId: CompanyId | undefined;
    if (options?.companyName) {
      companyId = await this.findCompanyByName(options.companyName);
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
        companyId: companyId,
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

    // Send welcome email with password - only if user was created successfully
    if (savedUser) {
      try {
        const roleNames = user.roles?.map(role => role.name) || [];
        this.logger.log({
          message: 'Sending welcome email with extended data',
          email: emailStr,
          firstName,
          roles: roleNames,
          companyName: options?.companyName,
        });
        await this.emailService.sendWelcomeEmailWithPassword(emailStr, firstName, actualPassword!, options?.companyName, roleNames);
      } catch (error) {
        this.logger.error({
          message: 'Error sending welcome email',
          email: emailStr,
          error: error.message,
        });
        // Continue even if email sending fails
      }

      // Send welcome SMS if user has phone number
      try {
        if (savedUser.profile?.phone) {
          this.logger.log({
            message: 'Sending welcome SMS to user with extended data',
            phone: savedUser.profile.phone,
            firstName,
          });
          const frontendUrl = this.configService.get('frontend.url', 'http://localhost:3000');
          const dashboardPath = this.configService.get('frontend.dashboardPath', '/dashboard');
          const dashboardUrl = `${frontendUrl}${dashboardPath}`;

          await this.smsService.sendWelcomeSms(
            savedUser.profile.phone,
            firstName,
            actualPassword!,
            dashboardUrl,
            savedUser.id.getValue(),
          );
        } else {
          this.logger.debug({
            message: 'User has no phone configured, skipping welcome SMS',
            email: emailStr,
          });
        }
      } catch (error) {
        this.logger.error({
          message: 'Error sending welcome SMS',
          phone: savedUser.profile?.phone,
          error: error.message,
        });
        // Continue even if SMS sending fails
      }
    }

    return savedUser;
  }

  async validateCredentials(emailStr: string, passwordStr: string): Promise<IAuthValidationResult> {
    // Input validation
    if (!emailStr || typeof emailStr !== 'string' || emailStr.trim() === '') {
      return {
        success: false,
        failureReason: AuthFailureReason.INVALID_EMAIL_FORMAT,
        message: 'Email is required',
      };
    }

    if (!passwordStr || typeof passwordStr !== 'string' || passwordStr.trim() === '') {
      return {
        success: false,
        failureReason: AuthFailureReason.INVALID_PASSWORD,
        message: 'Password is required',
      };
    }

    try {
      // Validate email format
      let email: Email;
      try {
        email = new Email(emailStr.trim());
      } catch (error) {
        return {
          success: false,
          failureReason: AuthFailureReason.INVALID_EMAIL_FORMAT,
          message: 'Invalid email format',
          details: {
            systemError: error instanceof Error ? error.message : String(error),
          },
        };
      }

      // Attempt to find user with comprehensive error handling
      let user;
      try {
        user = await this.userRepository.findByEmail(email.getValue());
      } catch (repositoryError) {
        const errorMessage = repositoryError instanceof Error ? repositoryError.message : String(repositoryError);
        const errorType = repositoryError?.constructor?.name || 'Unknown';

        this.logger.error({
          message: 'Repository error during user lookup',
          email: emailStr,
          error: errorMessage,
          errorType,
          stack: repositoryError instanceof Error ? repositoryError.stack : undefined,
        });

        return {
          success: false,
          failureReason: AuthFailureReason.SYSTEM_ERROR,
          message: 'Database error during authentication',
          details: {
            systemError: `Repository error: ${errorMessage}`,
            errorType,
          },
        };
      }

      if (!user) {
        return {
          success: false,
          failureReason: AuthFailureReason.USER_NOT_FOUND,
          message: 'User not found',
        };
      }

      // Check if user is inactive
      if (!user.isActive) {
        return {
          success: false,
          failureReason: AuthFailureReason.USER_INACTIVE,
          message: 'User account is deactivated',
        };
      }

      // Check if user is banned with comprehensive ban validation
      if (user.bannedUntil) {
        const now = new Date();
        if (user.bannedUntil > now) {
          return {
            success: false,
            failureReason: AuthFailureReason.USER_BANNED,
            message: `Account is banned until ${user.bannedUntil.toISOString()}`,
            details: {
              bannedUntil: user.bannedUntil,
              banReason: user.banReason || 'No reason provided',
            },
          };
        }
        // If ban has expired, we could optionally clear it here
        // but we'll leave that for a separate cleanup process
      }

      // Validate password with error handling
      let isPasswordValid: boolean;
      try {
        isPasswordValid = await this.comparePasswords(passwordStr, user.passwordHash);
      } catch (passwordError) {
        const errorMessage = passwordError instanceof Error ? passwordError.message : String(passwordError);

        this.logger.error({
          message: 'Password comparison error',
          email: emailStr,
          error: errorMessage,
          userId: user.id.getValue(),
        });

        return {
          success: false,
          failureReason: AuthFailureReason.SYSTEM_ERROR,
          message: 'Password validation error',
          details: {
            systemError: `Password comparison failed: ${errorMessage}`,
            errorType: passwordError?.constructor?.name || 'Unknown',
          },
        };
      }

      if (!isPasswordValid) {
        return {
          success: false,
          failureReason: AuthFailureReason.INVALID_PASSWORD,
          message: 'Invalid password',
        };
      }

      // All validations passed
      return {
        success: true,
        user,
        message: 'Credentials validated successfully',
      };

    } catch (error) {
      // Catch-all for any unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = error?.constructor?.name || 'Unknown';

      this.logger.error({
        message: 'Unexpected system error in validateCredentials',
        email: emailStr,
        error: errorMessage,
        errorType: errorType,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        failureReason: AuthFailureReason.SYSTEM_ERROR,
        message: 'Unexpected system error during authentication',
        details: {
          systemError: errorMessage,
          errorType: errorType,
        },
      };
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

    let role = await this.roleRepository.findById(roleId);
    if (!role) {
      role = await this.roleRepository.findByName(roleId);
      if (!role) {
        throw new EntityNotFoundException('Role', roleId);
      }
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

    // Additional validation: Use centralized authorization service for role assignment
    if (assigningUser && companyId) {
      if (!this.userAuthorizationService.canAssignRolesToUser(assigningUser, companyId)) {
        throw new BusinessRuleValidationException('You do not have permission to assign roles to users in this company.');
      }

      if (!this.userAuthorizationService.canAssignRole(assigningUser, user, role)) {
        throw new BusinessRuleValidationException('You do not have permission to assign this role to this user.');
      }
    }

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
    const saltRounds = this.configService.get<number>('PASSWORD_SALT_ROUNDS', 12);
    const salt = await bcrypt.genSalt(saltRounds);

    return bcrypt.hash(password, salt);
  }

  private async comparePasswords(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  private async findCompanyByName(companyName: string): Promise<CompanyId> {
    const companyNameVO = new CompanyName(companyName);

    const company = await this.companyRepository.findByName(companyNameVO);

    if (!company) {
      throw new EntityNotFoundException('Company', companyName);
    }

    this.logger.log({
      message: 'Found existing company for user registration',
      companyName,
      companyId: company.id.getValue(),
    });

    return company.id;
  }
}
