import { Role } from './role.entity';
import { Email } from '@core/value-objects/email.vo';
import { FirstName, LastName } from '@core/value-objects/name.vo';
import { SecondLastName } from '@core/value-objects/second-lastname.vo';
import { AgentPhone } from '@core/value-objects/agent-phone.vo';
import { UserProfile } from '@core/value-objects/user-profile.vo';
import { UserAddress } from './user-address.entity';
import { UserId } from '@core/value-objects/user-id.vo';
import { UserAddressId } from '@core/value-objects/user-address-id.vo';
import { CountryId } from '@core/value-objects/country-id.vo';
import { StateId } from '@core/value-objects/state-id.vo';
import { RoleId } from '@core/value-objects/role-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { AggregateRoot } from '@core/events/domain-event.base';
import { NotificationStatus } from '@prisma/client';
import {
  UserRegisteredEvent,
  UserActivatedEvent,
  UserDeactivatedEvent,
  UserRoleAssignedEvent,
  UserRoleRemovedEvent,
  UserPasswordChangedEvent,
  UserEmailChangedEvent,
  UserTwoFactorEnabledEvent,
  UserTwoFactorDisabledEvent,
  UserLastLoginUpdatedEvent,
} from '@core/events/user.events';
import {
  UserNotEligibleForRoleException,
  InactiveUserException,
  InvalidValueObjectException,
  BusinessRuleValidationException,
} from '@core/exceptions/domain-exceptions';
import { CanAssignRoleSpecification } from '@core/specifications/user.specifications';
import { RolesCollection } from '@core/value-objects/collections/roles.collection';

export class User extends AggregateRoot {
  private readonly _id: UserId;
  private _email: Email;
  private _passwordHash: string;
  private _firstName: FirstName;
  private _lastName: LastName;
  private _secondLastName?: SecondLastName;
  private _alias?: string; // Bot user alias (for bot identification)
  private _isActive: boolean;
  private _isReactivable: boolean; // false means user is banned and cannot be reactivated
  private _emailVerified: boolean;
  private _otpEnabled: boolean;
  private _otpSecret?: string;
  private _roles: Role[];
  private _lastLoginAt?: Date;
  private _bannedUntil?: Date;
  private _banReason?: string;
  private _agentPhone?: AgentPhone;
  private _profile?: UserProfile;
  private _address?: UserAddress;
  // Temporary fields for presentation (not persisted)
  private _countryName?: string;
  private _stateName?: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _companyId?: CompanyId | null;
  private _smsStatus: NotificationStatus;
  private _emailStatus: NotificationStatus;
  private _lastSmsError?: string;
  private _lastEmailError?: string;

  private constructor(
    id: UserId,
    email: Email,
    passwordHash: string,
    firstName: FirstName,
    lastName: LastName,
    isActive: boolean = true,
    createdAt?: Date,
    companyId?: CompanyId | null,
    alias?: string,
  ) {
    super();
    this._id = id;
    this._email = email;
    this._passwordHash = passwordHash;
    this._firstName = firstName;
    this._lastName = lastName;
    this._alias = alias;
    this._isActive = isActive;
    this._isReactivable = true; // By default, users are reactivable
    this._emailVerified = false;
    this._otpEnabled = false;
    this._roles = [];
    this._createdAt = createdAt || new Date();
    this._updatedAt = new Date();
    this._companyId = companyId;
    this._smsStatus = NotificationStatus.NOT_PROVIDED;
    this._emailStatus = NotificationStatus.NOT_PROVIDED;
    this._lastSmsError = undefined;
    this._lastEmailError = undefined;
  }

  // Factory method for creating new users
  static create(
    email: Email,
    passwordHash: string,
    firstName: FirstName,
    lastName: LastName,
    companyId?: CompanyId | null,
    alias?: string,
  ): User {
    const userId = UserId.create();
    const user = new User(
      userId,
      email,
      passwordHash,
      firstName,
      lastName,
      true,
      undefined,
      companyId,
      alias,
    );

    user.addDomainEvent(
      new UserRegisteredEvent(userId, email.getValue(), firstName.getValue(), lastName.getValue()),
    );

    return user;
  }

  // Factory method for creating users with extended data
  static createWithExtendedData(
    email: Email,
    passwordHash: string,
    firstName: FirstName,
    lastName: LastName,
    options?: {
      secondLastName?: SecondLastName;
      isActive?: boolean;
      isReactivable?: boolean;
      emailVerified?: boolean;
      bannedUntil?: Date;
      banReason?: string;
      agentPhone?: AgentPhone;
      profile?: UserProfile;
      address?: UserAddress;
      companyId?: CompanyId;
      userId?: UserId;
    },
  ): User {
    const userId = options.userId ?? UserId.create();
    const user = new User(
      userId,
      email,
      passwordHash,
      firstName,
      lastName,
      options?.isActive ?? true,
      undefined,
      options?.companyId,
    );

    // Set extended fields
    user._secondLastName = options?.secondLastName;
    user._isReactivable = options?.isReactivable ?? true;
    user._emailVerified = options?.emailVerified ?? false;
    user._bannedUntil = options?.bannedUntil;
    user._banReason = options?.banReason;
    user._agentPhone = options?.agentPhone;
    user._profile = options?.profile;
    user._address = options?.address;

    user.addDomainEvent(
      new UserRegisteredEvent(userId, email.getValue(), firstName.getValue(), lastName.getValue()),
    );

    return user;
  }

  // Factory method for reconstituting from persistence
  static fromData(data: {
    id: string;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    secondLastName?: string;
    alias?: string;
    isActive: boolean;
    isReactivable?: boolean;
    emailVerified?: boolean;
    otpEnabled: boolean;
    otpSecret?: string;
    roles: Role[];
    lastLoginAt?: Date;
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
      id: string;
      countryId?: string;
      countryName?: string;
      stateId?: string;
      stateName?: string;
      city?: string;
      street?: string;
      exteriorNumber?: string;
      interiorNumber?: string;
      postalCode?: string;
      createdAt: Date;
      updatedAt: Date;
    };
    createdAt: Date;
    updatedAt: Date;
    companyId?: string;
    smsStatus?: NotificationStatus;
    emailStatus?: NotificationStatus;
    lastSmsError?: string;
    lastEmailError?: string;
  }): User {
    const user = new User(
      UserId.fromString(data.id),
      new Email(data.email),
      data.passwordHash,
      new FirstName(data.firstName),
      new LastName(data.lastName),
      data.isActive,
      data.createdAt,
      data.companyId ? CompanyId.fromString(data.companyId) : undefined,
      data.alias,
    );

    user._secondLastName = data.secondLastName
      ? new SecondLastName(data.secondLastName)
      : undefined;
    user._isReactivable = data.isReactivable ?? true;
    user._emailVerified = data.emailVerified || false;
    user._otpEnabled = data.otpEnabled;
    user._otpSecret = data.otpSecret;
    user._roles = data.roles;
    user._lastLoginAt = data.lastLoginAt;
    user._bannedUntil = data.bannedUntil;
    user._banReason = data.banReason;
    user._agentPhone = data.agentPhone
      ? new AgentPhone(data.agentPhone, data.agentPhoneCountryCode)
      : undefined;
    user._profile = data.profile
      ? new UserProfile(
          data.profile.phone,
          data.profile.phoneCountryCode,
          data.profile.avatarUrl,
          data.profile.bio,
          data.profile.birthDate,
        )
      : undefined;
    user._address = data.address
      ? UserAddress.reconstruct(UserAddressId.fromString(data.address.id), {
          userId: user._id,
          countryId: data.address.countryId
            ? CountryId.fromString(data.address.countryId)
            : undefined,
          stateId: data.address.stateId ? StateId.fromString(data.address.stateId) : undefined,
          city: data.address.city,
          street: data.address.street,
          exteriorNumber: data.address.exteriorNumber,
          interiorNumber: data.address.interiorNumber,
          postalCode: data.address.postalCode,
          createdAt: data.address.createdAt,
          updatedAt: data.address.updatedAt,
        })
      : undefined;

    // Set temporary presentation fields
    user._countryName = data.address?.countryName;
    user._stateName = data.address?.stateName;
    user._updatedAt = data.updatedAt;
    user._smsStatus = data.smsStatus || NotificationStatus.NOT_PROVIDED;
    user._emailStatus = data.emailStatus || NotificationStatus.NOT_PROVIDED;
    user._lastSmsError = data.lastSmsError;
    user._lastEmailError = data.lastEmailError;

    return user;
  }

  // Getters
  get id(): UserId {
    return this._id;
  }

  get email(): Email {
    return this._email;
  }

  get passwordHash(): string {
    return this._passwordHash;
  }

  get firstName(): FirstName {
    return this._firstName;
  }

  get lastName(): LastName {
    return this._lastName;
  }

  get alias(): string | undefined {
    return this._alias;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get isReactivable(): boolean {
    return this._isReactivable;
  }

  get emailVerified(): boolean {
    return this._emailVerified;
  }

  get otpEnabled(): boolean {
    return this._otpEnabled;
  }

  get otpSecret(): string | undefined {
    return this._otpSecret;
  }

  get roles(): Role[] {
    return [...this._roles]; // Return copy to prevent external mutation
  }

  get rolesCollection(): RolesCollection {
    return RolesCollection.create(this._roles);
  }

  /**
   * Get the role with the highest hierarchy (lowest hierarchy level number) for this user
   * Used for security validations in role assignments
   */
  getHighestHierarchyRole(): Role | null {
    if (!this._roles || this._roles.length === 0) {
      return null;
    }

    // Find role with lowest hierarchy level (highest privilege)
    return this._roles.reduce(
      (highest, current) => {
        if (!highest) return current;

        return current.hasHigherHierarchyThan(highest) ? current : highest;
      },
      null as Role | null,
    );
  }

  get lastLoginAt(): Date | undefined {
    return this._lastLoginAt;
  }

  get bannedUntil(): Date | undefined {
    return this._bannedUntil;
  }

  get banReason(): string | undefined {
    return this._banReason;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get companyId(): CompanyId | null | undefined {
    return this._companyId;
  }

  get secondLastName(): SecondLastName | undefined {
    return this._secondLastName;
  }

  get agentPhone(): AgentPhone | undefined {
    return this._agentPhone;
  }

  get profile(): UserProfile | undefined {
    return this._profile;
  }

  get address(): UserAddress | undefined {
    return this._address;
  }

  get countryName(): string | undefined {
    return this._countryName;
  }

  get stateName(): string | undefined {
    return this._stateName;
  }

  get smsStatus(): NotificationStatus {
    return this._smsStatus;
  }

  get emailStatus(): NotificationStatus {
    return this._emailStatus;
  }

  get lastSmsError(): string | undefined {
    return this._lastSmsError;
  }

  get lastEmailError(): string | undefined {
    return this._lastEmailError;
  }

  // Business methods with proper encapsulation and rules
  activate(by: User): void {
    if (this._isActive) {
      return; // Already active, no change needed
    }

    // Check if user is reactivable (not banned)
    if (!this._isReactivable) {
      throw new BusinessRuleValidationException(
        'Cannot activate a banned user. User must be unbanned first.',
      );
    }

    this._isActive = true;
    this._updatedAt = new Date();
    this.addDomainEvent(new UserActivatedEvent(this._id, by.id.getValue()));
  }

  deactivate(by: User): void {
    if (!this._isActive) {
      return; // Already inactive, no change needed
    }

    this._isActive = false;
    this._updatedAt = new Date();
    this.addDomainEvent(new UserDeactivatedEvent(this._id, by.id.getValue()));
  }

  markEmailAsVerified(): void {
    if (this._emailVerified) {
      return; // Already verified, no change needed
    }

    this._emailVerified = true;
    this._updatedAt = new Date();
    // Note: We could add an EmailVerifiedEvent if needed for domain events
  }

  enableTwoFactor(secret: string): void {
    if (!secret || secret.trim().length === 0) {
      throw new InvalidValueObjectException('Two-factor secret cannot be empty');
    }

    if (!this._isActive) {
      throw new InactiveUserException('enable two-factor authentication');
    }

    this._otpEnabled = true;
    this._otpSecret = secret;
    this._updatedAt = new Date();
    this.addDomainEvent(new UserTwoFactorEnabledEvent(this._id));
  }

  disableTwoFactor(): void {
    if (!this._otpEnabled) {
      return; // Already disabled, no change needed
    }

    this._otpEnabled = false;
    this._otpSecret = undefined;
    this._updatedAt = new Date();
    this.addDomainEvent(new UserTwoFactorDisabledEvent(this._id));
  }

  // Aliases for backward compatibility
  enableOtp(secret: string): void {
    this.enableTwoFactor(secret);
  }

  disableOtp(): void {
    this.disableTwoFactor();
  }

  addRole(role: Role): void {
    // Check if user already has this role - if so, this is a no-op (idempotent)
    if (this.hasRole(role.id)) {
      return; // Successfully "assigned" - user already has the role
    }

    // Use specification pattern for business rule validation
    const canAssignRoleSpec = new CanAssignRoleSpecification(role);

    if (!canAssignRoleSpec.isSatisfiedBy(this)) {
      if (!this._isActive) {
        throw new InactiveUserException('assign role');
      }
      throw new UserNotEligibleForRoleException(this._id.getValue(), role.name);
    }

    this._roles.push(role);
    this._updatedAt = new Date();
    this.addDomainEvent(new UserRoleAssignedEvent(this._id, role.id, role.name));
  }

  removeRole(roleId: RoleId): void {
    if (!this._isActive) {
      throw new InactiveUserException('remove role');
    }

    if (this._roles.length <= 1) {
      //throw new UserCannotRemoveLastRoleException();
    }

    const roleToRemove = this._roles.find(r => r.id.equals(roleId));
    if (!roleToRemove) {
      return; // Role not found, no change needed
    }

    this._roles = this._roles.filter(r => !r.id.equals(roleId));
    this._updatedAt = new Date();
    this.addDomainEvent(new UserRoleRemovedEvent(this._id, roleId, roleToRemove.name));
  }

  changeEmail(newEmail: Email): void {
    if (!this._isActive) {
      throw new InactiveUserException('change email');
    }

    if (this._email.equals(newEmail)) {
      return; // Same email, no change needed
    }

    const oldEmail = this._email.getValue();
    this._email = newEmail;
    this._updatedAt = new Date();
    this.addDomainEvent(new UserEmailChangedEvent(this._id, oldEmail, newEmail.getValue()));
  }

  changePassword(newPasswordHash: string): void {
    if (!newPasswordHash || newPasswordHash.trim().length === 0) {
      throw new InvalidValueObjectException('Password hash cannot be empty');
    }

    if (!this._isActive) {
      throw new InactiveUserException('change password');
    }

    this._passwordHash = newPasswordHash;
    this._updatedAt = new Date();
    this.addDomainEvent(new UserPasswordChangedEvent(this._id));
  }

  updateLastLogin(): void {
    const now = new Date();
    this._lastLoginAt = now;
    this._updatedAt = now;
    this.addDomainEvent(new UserLastLoginUpdatedEvent(this._id, now));
  }

  updateProfile(firstName?: FirstName, lastName?: LastName): void {
    if (!this._isActive) {
      throw new InactiveUserException('update profile');
    }

    let hasChanges = false;

    if (firstName && !this._firstName.equals(firstName)) {
      this._firstName = firstName;
      hasChanges = true;
    }

    if (lastName && !this._lastName.equals(lastName)) {
      this._lastName = lastName;
      hasChanges = true;
    }

    if (hasChanges) {
      this._updatedAt = new Date();
    }
  }

  // Query methods
  hasRole(roleId: RoleId): boolean {
    return this._roles.some(r => r.id.equals(roleId));
  }

  hasPermission(permissionName: string): boolean {
    return this.rolesCollection.hasPermission(permissionName);
  }

  getFullName(): string {
    return `${this._firstName.getValue()} ${this._lastName.getValue()}`;
  }

  isEligibleForAdminRole(): boolean {
    // Business rule: Active users can be assigned admin roles (admin is now a regular role)
    return this._isActive;
  }

  isEligibleForRootRole(): boolean {
    // Business rule: Only users with existing root privileges can be assigned root roles
    return this._isActive && this.rolesCollection.hasRootPrivileges();
  }

  hasRootPrivileges(): boolean {
    return this.rolesCollection.hasRootPrivileges();
  }

  hasRootReadOnlyPrivileges(): boolean {
    return this.rolesCollection.hasRootReadOnlyPrivileges();
  }

  hasRootLevelPrivileges(): boolean {
    return this.rolesCollection.hasRootLevelPrivileges();
  }

  assignToCompany(companyId: CompanyId): void {
    if (!this._isActive) {
      throw new InactiveUserException('assign to company');
    }

    this._companyId = companyId;
    this._updatedAt = new Date();
  }

  removeFromCompany(): void {
    if (!this._companyId) {
      return;
    }

    this._companyId = null;
    this._updatedAt = new Date();
  }

  getTenantId(): string | undefined {
    return this._companyId?.getValue();
  }

  // Ban management methods
  isBanned(): boolean {
    if (!this._bannedUntil) {
      return !this._isReactivable && !this._isActive; // permanent
    }

    return new Date() < this._bannedUntil; // temporal
  }

  banUser(bannedUntil: Date, banReason: string): void {
    if (bannedUntil <= new Date()) {
      throw new InvalidValueObjectException('Ban expiration date must be in the future');
    }

    this._bannedUntil = bannedUntil;
    this._banReason = banReason;
    this._isReactivable = false; // Banned users are not reactivable
    this._isActive = false; // Deactivate banned users
    this._updatedAt = new Date();
  }

  unbanUser(): void {
    this._bannedUntil = undefined;
    this._banReason = undefined;
    this._isReactivable = true; // Unbanned users become reactivable
    this._updatedAt = new Date();
  }

  /**
   * Permanently ban a user - they cannot be reactivated until unbanned
   */
  permanentlyBanUser(banReason: string): void {
    this._bannedUntil = undefined; // No expiration date for permanent ban
    this._banReason = banReason;
    this._isReactivable = false; // Cannot be reactivated
    this._isActive = false; // Deactivate banned users
    this._updatedAt = new Date();
  }

  // Profile and extended data setters
  setSecondLastName(secondLastName?: SecondLastName): void {
    this._secondLastName = secondLastName;
    this._updatedAt = new Date();
  }

  setAgentPhone(agentPhone?: AgentPhone): void {
    this._agentPhone = agentPhone;
    this._updatedAt = new Date();
  }

  setProfile(profile?: UserProfile): void {
    this._profile = profile;
    this._updatedAt = new Date();
  }

  setAddress(address?: UserAddress): void {
    this._address = address;
    this._updatedAt = new Date();
  }

  // Notification status setters
  setSmsStatus(status: NotificationStatus): void {
    this._smsStatus = status;
    this._updatedAt = new Date();
  }

  setEmailStatus(status: NotificationStatus): void {
    this._emailStatus = status;
    this._updatedAt = new Date();
  }

  setLastSmsError(error?: string): void {
    this._lastSmsError = error;
    this._updatedAt = new Date();
  }

  setLastEmailError(error?: string): void {
    this._lastEmailError = error;
    this._updatedAt = new Date();
  }

  updateNotificationStatus(
    type: 'sms' | 'email',
    status: NotificationStatus,
    error?: string,
  ): void {
    if (type === 'sms') {
      this._smsStatus = status;
      this._lastSmsError = status === NotificationStatus.SENT ? undefined : error;
    } else {
      this._emailStatus = status;
      this._lastEmailError = status === NotificationStatus.SENT ? undefined : error;
    }
    this._updatedAt = new Date();
  }

  /**
   * Calculate invitation status based on user state
   */
  calculateInvitationStatus(): 'pending' | 'completed' | 'error' | 'expired' {
    // If email is already verified, invitation is completed
    if (this._emailVerified) {
      return 'completed';
    }

    // Check if invitation is expired (1 month = 30 days)
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (this._createdAt < oneMonthAgo) {
      return 'expired';
    }

    // Check for send errors
    if (
      this._emailStatus === NotificationStatus.SEND_ERROR ||
      this._smsStatus === NotificationStatus.SEND_ERROR
    ) {
      return 'error';
    }

    // Default: invitation is pending
    return 'pending';
  }
}
