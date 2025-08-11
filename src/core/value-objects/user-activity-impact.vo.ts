import { UserActivityImpact as UserActivityImpactEnum } from '@shared/constants/user-activity-impact.enum';
import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

export class UserActivityImpact {
  private readonly value: UserActivityImpactEnum;

  private constructor(value: UserActivityImpactEnum) {
    this.value = value;
  }

  public getValue(): UserActivityImpactEnum {
    return this.value;
  }

  public equals(other: UserActivityImpact): boolean {
    return this.value === other.value;
  }

  public static create(value: string): UserActivityImpact {
    if (!Object.values(UserActivityImpactEnum).includes(value as UserActivityImpactEnum)) {
      throw new InvalidValueObjectException(`Invalid user activity impact: ${value}`);
    }

    return new UserActivityImpact(value as UserActivityImpactEnum);
  }

  public static LOW(): UserActivityImpact {
    return new UserActivityImpact(UserActivityImpactEnum.LOW);
  }

  public static MEDIUM(): UserActivityImpact {
    return new UserActivityImpact(UserActivityImpactEnum.MEDIUM);
  }

  public static HIGH(): UserActivityImpact {
    return new UserActivityImpact(UserActivityImpactEnum.HIGH);
  }

  public static CRITICAL(): UserActivityImpact {
    return new UserActivityImpact(UserActivityImpactEnum.CRITICAL);
  }
}
