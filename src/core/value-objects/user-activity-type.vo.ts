import { UserActivityType as UserActivityTypeEnum } from '@shared/constants/user-activity-type.enum';
import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

export class UserActivityType {
  private readonly value: UserActivityTypeEnum;

  private constructor(value: UserActivityTypeEnum) {
    this.value = value;
  }

  public getValue(): UserActivityTypeEnum {
    return this.value;
  }

  public equals(other: UserActivityType): boolean {
    return this.value === other.value;
  }

  public static create(value: string): UserActivityType {
    if (!Object.values(UserActivityTypeEnum).includes(value as UserActivityTypeEnum)) {
      throw new InvalidValueObjectException(`Invalid user activity type: ${value}`);
    }

    return new UserActivityType(value as UserActivityTypeEnum);
  }

  public static AUTHENTICATION(): UserActivityType {
    return new UserActivityType(UserActivityTypeEnum.AUTHENTICATION);
  }

  public static PROFILE_MANAGEMENT(): UserActivityType {
    return new UserActivityType(UserActivityTypeEnum.PROFILE_MANAGEMENT);
  }

  public static ROLE_MANAGEMENT(): UserActivityType {
    return new UserActivityType(UserActivityTypeEnum.ROLE_MANAGEMENT);
  }

  public static SECURITY_SETTINGS(): UserActivityType {
    return new UserActivityType(UserActivityTypeEnum.SECURITY_SETTINGS);
  }

  public static COMPANY_ASSIGNMENT(): UserActivityType {
    return new UserActivityType(UserActivityTypeEnum.COMPANY_ASSIGNMENT);
  }

  public static ACCOUNT_MANAGEMENT(): UserActivityType {
    return new UserActivityType(UserActivityTypeEnum.ACCOUNT_MANAGEMENT);
  }
}
