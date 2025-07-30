export class PasswordResetAttempt {
  public readonly id: string;
  public readonly email: string;
  public readonly ipAddress?: string;
  public readonly userAgent?: string;
  public readonly createdAt: Date;

  constructor(
    email: string,
    ipAddress?: string,
    userAgent?: string,
    id?: string,
    createdAt?: Date,
  ) {
    this.id = id || crypto.randomUUID();
    this.email = email;
    this.ipAddress = ipAddress;
    this.userAgent = userAgent;
    this.createdAt = createdAt || new Date();
  }

  static create(email: string, ipAddress?: string, userAgent?: string): PasswordResetAttempt {
    return new PasswordResetAttempt(email, ipAddress, userAgent);
  }
}
