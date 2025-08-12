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
import { UserAddress } from '@core/entities/user-address.entity';
import { RoleId } from '@core/value-objects/role-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { DomainValidationService } from './domain-validation.service';
import { UserAuthorizationService } from './user-authorization.service';
import { UserAccessAuthorizationService } from './user-access-authorization.service';
import { PasswordGenerator } from '@shared/utils/password-generator';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { ConfigService } from '@nestjs/config';
import { ILogger } from '@core/interfaces/logger.interface';
import { AuthFailureReason, IAuthValidationResult } from '@shared/constants/auth-failure-reason.enum';
import { BusinessConfigurationService } from './business-configuration.service';
import { IUpdateUserProfileServiceInput } from '@core/interfaces/user/update-user-profile-service-input.interface';

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
    private readonly userAccessAuthorizationService: UserAccessAuthorizationService,
    private readonly businessConfigService: BusinessConfigurationService,
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

    let addressVO: UserAddress | undefined;
    if (options?.address) {
      addressVO = UserAddress.create({
        userId: UserId.create(), // Temporary, will be set after user creation
        city: options.address.city,
        street: options.address.street,
        exteriorNumber: options.address.exteriorNumber,
        interiorNumber: options.address.interiorNumber,
        postalCode: options.address.postalCode,
      });
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

  async adminChangeUserPassword(
    targetUserId: string,
    newPassword: string,
    adminUserId: string,
  ): Promise<User> {
    // Get admin user using authorization service
    const adminUser = await this.userAuthorizationService.getCurrentUserSafely(adminUserId);

    // Find the target user
    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new EntityNotFoundException('User', targetUserId);
    }

    // Validate authorization using domain service
    this.userAuthorizationService.canAdminChangePassword(adminUser, targetUser);

    // Hash the new password using business configuration
    const passwordConfig = this.businessConfigService.getPasswordSecurityConfig();
    const hashedPassword = await bcrypt.hash(newPassword, passwordConfig.saltRounds);

    // Update the user's password
    targetUser.changePassword(hashedPassword);
    
return await this.userRepository.update(targetUser);
  }

  async findUserByEmailForVerification(email: string): Promise<User | null> {
    // Validate email format using value object
    const emailVO = new Email(email);
    
return await this.userRepository.findByEmail(emailVO.getValue());
  }

  async getUserWithPermissionsForRefreshToken(userId: string): Promise<{
    user: User;
    permissions: string[];
  }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new EntityNotFoundException('User', userId);
    }

    // Collect all permissions from all user roles
    const userPermissions = new Set<string>();
    for (const role of user.roles) {
      const roleWithPermissions = await this.roleRepository.findById(role.id.getValue());
      if (roleWithPermissions && roleWithPermissions.permissions) {
        roleWithPermissions.permissions.forEach(permission => {
          userPermissions.add(permission.getStringName());
        });
      }
    }

    return {
      user,
      permissions: Array.from(userPermissions),
    };
  }

  async getUserById(userId: string): Promise<User | null> {
    return await this.userRepository.findById(userId);
  }

  async getAllUsers(companyId?: string): Promise<User[]> {
    if (companyId) {
      return await this.userRepository.findAllByCompanyId(companyId);
    }
    
return await this.userRepository.findAll();
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const emailVO = new Email(email);
    
return await this.userRepository.findByEmail(emailVO.getValue());
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

  async removeRoleFromUserWithAuthorization(
    targetUserId: string,
    roleId: string,
    currentUserId: string,
  ): Promise<User> {
    // Get current user using centralized method
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(currentUserId);

    // Get target user
    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new EntityNotFoundException('User', targetUserId);
    }

    // Get role to be removed
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new EntityNotFoundException('Role', roleId);
    }

    // Check authorization using domain service
    if (!this.userAuthorizationService.canRemoveRoleFromUser(currentUser, targetUser, role)) {
      throw new BusinessRuleValidationException('You do not have permission to remove this role from this user');
    }

    return await this.removeRoleFromUser(targetUserId, roleId);
  }

  async activateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new EntityNotFoundException('User', userId);
    }

    user.activate();

    return this.userRepository.update(user);
  }

  async activateUserWithAuthorization(
    targetUserId: string,
    active: boolean,
    currentUserId: string,
  ): Promise<User> {
    // Get current user using centralized method
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(currentUserId);

    // Get target user to get their company ID
    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new EntityNotFoundException('User', targetUserId);
    }

    // Check authorization using domain service
    const targetUserCompanyId = targetUser.companyId?.getValue() || '';
    if (!this.userAuthorizationService.canActivateUser(currentUser, targetUserCompanyId)) {
      throw new BusinessRuleValidationException('You do not have permission to activate/deactivate this user');
    }

    if (active) {
      return await this.activateUser(targetUserId);
    } else {
      return await this.deactivateUser(targetUserId);
    }
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

  async deleteUser(targetUserId: string, currentUserId: string): Promise<{ message: string; companyId: string }> {
    // Get current user using centralized method
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(currentUserId);

    // Get target user
    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new EntityNotFoundException('User', targetUserId);
    }

    // Check authorization using domain service
    if (!this.userAuthorizationService.canDeleteUser(currentUser, targetUser)) {
      throw new BusinessRuleValidationException('You do not have permission to delete this user');
    }

    // Delete user using repository method
    const deleteResult = await this.userRepository.delete(targetUserId);

    if (!deleteResult) {
      throw new Error('Failed to delete user');
    }

    return { message: 'User deleted successfully', companyId: targetUser.companyId?.getValue() || '' };
  }

  async createBotUser(
    alias: string,
    companyId: string,
    password: string,
    currentUserId: string,
  ): Promise<User> {
    // Get current user for authorization
    const currentUser = await this.userRepository.findById(currentUserId);
    if (!currentUser) {
      throw new EntityNotFoundException('User', currentUserId);
    }

    // Authorization check: Only Root users can create bot users
    if (!this.userAuthorizationService.canAccessRootFeatures(currentUser)) {
      throw new BusinessRuleValidationException('Only ROOT users can create bot users');
    }

    // Verify company exists
    const companyIdVO = CompanyId.fromString(companyId);
    const company = await this.companyRepository.findById(companyIdVO);
    if (!company) {
      throw new EntityNotFoundException('Company', companyId);
    }

    // Check if alias already exists
    const existingUserByAlias = await this.userRepository.findByAlias(alias);
    if (existingUserByAlias) {
      throw new EntityAlreadyExistsException('User', 'alias');
    }

    // Generate unique dummy email for the bot
    const generatedEmail = this.generateSecureBotEmail(alias, companyId);
    const emailVO = new Email(generatedEmail);

    // Double check generated email is unique (should be, but safety first)
    const existingUserByEmail = await this.userRepository.findByEmail(generatedEmail);
    if (existingUserByEmail) {
      throw new EntityAlreadyExistsException('User', 'email');
    }

    // Hash password
    const passwordHash = await this.hashPassword(password);

    // Create bot user with generated email and minimal data
    const botUser = User.create(
      emailVO,
      passwordHash,
      new FirstName('Bot'), // Default first name
      new LastName('User'), // Default last name
      companyIdVO,
      alias,
    );

    // Save bot user
    return await this.userRepository.create(botUser);
  }

  async verifyPassword(userId: string, password: string, currentUserId: string): Promise<boolean> {
    // Get current user for authorization
    const currentUser = await this.userRepository.findById(currentUserId);
    if (!currentUser) {
      throw new EntityNotFoundException('User', currentUserId);
    }

    // Get target user
    const targetUser = await this.userRepository.findById(userId);
    if (!targetUser) {
      throw new EntityNotFoundException('User', userId);
    }

    // Authorization check: users can only verify their own password or admins can verify others
    if (currentUserId !== userId && !this.userAuthorizationService.canAccessAdminFeatures(currentUser)) {
      throw new BusinessRuleValidationException('You can only verify your own password');
    }

    // Verify password
    return await this.comparePasswords(password, targetUser.passwordHash);
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

  async updateUserProfile(
    targetUserId: string,
    currentUserId: string,
    updateData: IUpdateUserProfileServiceInput,
  ): Promise<User> {
    // Get both users
    const [targetUser, currentUser] = await Promise.all([
      this.userRepository.findById(targetUserId),
      this.userRepository.findById(currentUserId),
    ]);

    if (!targetUser) {
      throw new EntityNotFoundException('User', targetUserId);
    }

    if (!currentUser) {
      throw new EntityNotFoundException('Current user not found', currentUserId);
    }

    // Check authorization using the existing access authorization service
    await this.userAccessAuthorizationService.validateUserAccess(currentUser, targetUser);

    // Update user data based on provided fields
    let hasChanges = false;

    // Update basic profile information (firstName and lastName)
    if (updateData.firstName || updateData.lastName) {
      const firstName = new FirstName(updateData.firstName || targetUser.firstName.getValue());
      const lastName = new LastName(updateData.lastName || targetUser.lastName.getValue());
      targetUser.updateProfile(firstName, lastName);
      hasChanges = true;
    }

    // Update second last name if provided
    if (updateData.secondLastName !== undefined) {
      const secondLastName = updateData.secondLastName
        ? new SecondLastName(updateData.secondLastName)
        : undefined;
      targetUser.setSecondLastName(secondLastName);
      hasChanges = true;
    }

    // Update activation status
    if (updateData.isActive !== undefined) {
      if (updateData.isActive && !targetUser.isActive) {
        targetUser.activate();
        hasChanges = true;
      } else if (!updateData.isActive && targetUser.isActive) {
        targetUser.deactivate();
        hasChanges = true;
      }
    }

    // Update email verification status
    if (updateData.emailVerified !== undefined) {
      if (updateData.emailVerified && !targetUser.emailVerified) {
        targetUser.markEmailAsVerified();
        hasChanges = true;
      }
    }

    // Update ban status
    if (updateData.bannedUntil !== undefined || updateData.banReason !== undefined) {
      if (updateData.bannedUntil && updateData.banReason) {
        const banDate = new Date(updateData.bannedUntil);
        targetUser.banUser(banDate, updateData.banReason);
        hasChanges = true;
      } else if (
        updateData.bannedUntil === null ||
        updateData.banReason === null ||
        updateData.bannedUntil === '' ||
        updateData.banReason === ''
      ) {
        targetUser.unbanUser();
        hasChanges = true;
      }
    }

    // Update agent phone
    if (updateData.agentPhone !== undefined) {
      const agentPhone = updateData.agentPhone
        ? new AgentPhone(updateData.agentPhone, updateData.agentPhoneCountryCode)
        : undefined;
      targetUser.setAgentPhone(agentPhone);
      hasChanges = true;
    }

    // Update profile information
    if (updateData.profile) {
      const currentProfile = targetUser.profile;
      const newProfile = new UserProfile(
        updateData.profile.phone !== undefined ? updateData.profile.phone : currentProfile?.phone,
        updateData.profile.phoneCountryCode !== undefined
          ? updateData.profile.phoneCountryCode
          : currentProfile?.phoneCountryCode,
        updateData.profile.avatarUrl !== undefined
          ? updateData.profile.avatarUrl
          : currentProfile?.avatarUrl,
        updateData.profile.bio !== undefined ? updateData.profile.bio : currentProfile?.bio,
        updateData.profile.birthDate !== undefined
          ? (typeof updateData.profile.birthDate === 'string' ? updateData.profile.birthDate : updateData.profile.birthDate.toISOString())
          : currentProfile?.birthDate,
      );
      targetUser.setProfile(newProfile);
      hasChanges = true;
    }

    // Update address information
    if (updateData.address) {
      const currentAddress = targetUser.address;
      let newAddress: UserAddress;
      
      if (currentAddress) {
        // Update existing address
        currentAddress.updateFullAddress({
          city: updateData.address.city !== undefined ? updateData.address.city : currentAddress.city,
          street: updateData.address.street !== undefined ? updateData.address.street : currentAddress.street,
          exteriorNumber: updateData.address.exteriorNumber !== undefined ? updateData.address.exteriorNumber : currentAddress.exteriorNumber,
          interiorNumber: updateData.address.interiorNumber !== undefined ? updateData.address.interiorNumber : currentAddress.interiorNumber,
          postalCode: updateData.address.postalCode !== undefined ? updateData.address.postalCode : currentAddress.postalCode,
        });
        hasChanges = true;
      } else {
        // Create new address
        newAddress = UserAddress.create({
          userId: targetUser.id,
          city: updateData.address.city,
          street: updateData.address.street,
          exteriorNumber: updateData.address.exteriorNumber,
          interiorNumber: updateData.address.interiorNumber,
          postalCode: updateData.address.postalCode,
        });
        targetUser.setAddress(newAddress);
        hasChanges = true;
      }
    }

    // Save changes if any were made
    return hasChanges ? await this.userRepository.update(targetUser) : targetUser;
  }

  private generateSecureBotEmail(alias: string, companyId: string): string {
    // Create a complex hash combining alias, companyId, timestamp, and random data
    const timestamp = Date.now().toString(36);
    const randomBytes = Math.random().toString(36).substring(2, 10);
    const companyHash = companyId.replace(/-/g, '').substring(0, 8);
    const aliasHash = alias
      .replace(/[^a-z0-9]/gi, '')
      .toLowerCase()
      .substring(0, 6);

    // Combine all parts in a hard-to-decode way
    const uniqueIdentifier = `${aliasHash}${companyHash}${timestamp}${randomBytes}`;

    // Generate final email with bot prefix and secure domain
    return `bot.${uniqueIdentifier}@nauto.internal`;
  }
}
