import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { User } from '@core/entities/user.entity';
import { Email } from '@core/value-objects/email.vo';
import { FirstName, LastName } from '@core/value-objects/name.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { UserService } from '@core/services/user.service';
import { UserMapper } from '@application/mappers/user.mapper';
import { IUserDetailResponse } from '@application/dtos/responses/user.response';
import {
  EntityNotFoundException,
  ForbiddenActionException,
  EntityAlreadyExistsException,
} from '@core/exceptions/domain-exceptions';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';

export class CreateBotUserCommand implements ICommand {
  constructor(
    public readonly alias: string,
    public readonly companyId: string,
    public readonly password: string,
    public readonly currentUserId: string,
  ) {}
}

@CommandHandler(CreateBotUserCommand)
export class CreateBotUserCommandHandler implements ICommandHandler<CreateBotUserCommand> {
  constructor(
    @Inject(REPOSITORY_TOKENS.USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(REPOSITORY_TOKENS.COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
    private readonly userAuthorizationService: UserAuthorizationService,
    private readonly userService: UserService,
  ) {}

  async execute(command: CreateBotUserCommand): Promise<IUserDetailResponse> {
    const { alias, companyId, password, currentUserId } = command;

    // Get current user for authorization
    const currentUser = await this.userRepository.findById(currentUserId);
    if (!currentUser) {
      throw new EntityNotFoundException('User', currentUserId);
    }

    // Authorization check: Only Root users can create bot users
    if (!this.userAuthorizationService.canAccessRootFeatures(currentUser)) {
      throw new ForbiddenActionException('Only ROOT users can create bot users');
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
    const passwordHash = await this.userService.hashPassword(password);

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
    const savedUser = await this.userRepository.create(botUser);

    return UserMapper.toDetailResponse(savedUser);
  }

  /**
   * Generate a secure, unique, and hard-to-decipher email for bot users
   */
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
