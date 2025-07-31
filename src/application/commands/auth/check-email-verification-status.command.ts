import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, ForbiddenException, NotFoundException, Inject, Logger } from '@nestjs/common';
import { AuthService } from '@core/services/auth.service';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { RolesEnum } from '@shared/constants/enums';
import { Email } from '@core/value-objects/email.vo';
import { USER_REPOSITORY, COMPANY_REPOSITORY } from '@shared/constants/tokens';

export class CheckEmailVerificationStatusCommand implements ICommand {
  constructor(
    public readonly email: string,
    public readonly currentUserId: string,
    public readonly currentUserRoles: string[],
    public readonly currentUserCompanyId: string | null,
  ) {}
}

@Injectable()
@CommandHandler(CheckEmailVerificationStatusCommand)
export class CheckEmailVerificationStatusCommandHandler
  implements ICommandHandler<CheckEmailVerificationStatusCommand, boolean>
{
  private readonly logger = new Logger(CheckEmailVerificationStatusCommandHandler.name);

  constructor(
    private readonly authService: AuthService,
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: ICompanyRepository,
  ) {}

  async execute(command: CheckEmailVerificationStatusCommand): Promise<boolean> {
    const { email, currentUserId, currentUserRoles, currentUserCompanyId } = command;

    // Validate email format
    const emailValueObject = new Email(email);

    // Security checks based on role hierarchy
    await this.validateAccess(
      emailValueObject.getValue(),
      currentUserId,
      currentUserRoles,
      currentUserCompanyId,
    );

    // Check if the email is verified
    return this.authService.isEmailVerified(emailValueObject.getValue());
  }

  private async validateAccess(
    email: string,
    currentUserId: string,
    currentUserRoles: string[],
    currentUserCompanyId: string | null,
  ): Promise<void> {
    // Rule 1: Root role can check any email
    if (currentUserRoles.includes(RolesEnum.ROOT)) {
      return;
    }

    // Find the user by email to check company association
    const targetUser = await this.userRepository.findByEmail(email);

    // If user doesn't exist, we still need to apply access control
    // (We don't want to leak information about email existence)

    // Rule 2: Admin can check emails within their company and subsidiary companies
    if (currentUserRoles.includes(RolesEnum.ADMIN)) {
      // If target user exists, check if they belong to the same company
      if (targetUser && currentUserCompanyId) {
        if (targetUser.companyId?.getValue() === currentUserCompanyId) {
          return;
        }

        // Check if target user's company is a subsidiary of current user's company
        if (targetUser.companyId) {
          const targetCompany = await this.companyRepository.findById(targetUser.companyId);
          if (
            targetCompany &&
            (await this.isSubsidiaryCompany(currentUserCompanyId, targetCompany.id.getValue()))
          ) {
            return;
          }
        }
      }

      // Admin can also check their own email
      if (targetUser && targetUser.id.getValue() === currentUserId) {
        return;
      }

      // If no target user found, only allow if checking their own email
      const currentUser = await this.userRepository.findById(currentUserId);
      if (currentUser && currentUser.email.getValue() === email) {
        return;
      }

      throw new ForbiddenException(
        'You can only check email status within your company, subsidiary companies, or your own email',
      );
    }

    // Rule 3: Manager can check emails within their company
    if (currentUserRoles.includes(RolesEnum.MANAGER)) {
      // If target user exists, check if they belong to the same company
      if (targetUser && currentUserCompanyId) {
        if (targetUser.companyId?.getValue() === currentUserCompanyId) {
          return;
        }
      }

      // Manager can also check their own email
      if (targetUser && targetUser.id.getValue() === currentUserId) {
        return;
      }

      // If no target user found, only allow if checking their own email
      const currentUser = await this.userRepository.findById(currentUserId);
      if (currentUser && currentUser.email.getValue() === email) {
        return;
      }

      throw new ForbiddenException(
        'You can only check email status within your company or your own email',
      );
    }

    // Rule 4: Other roles can only check their own email
    const currentUser = await this.userRepository.findById(currentUserId);
    if (!currentUser) {
      throw new NotFoundException('Current user not found');
    }

    if (currentUser.email.getValue() !== email) {
      throw new ForbiddenException('You can only check your own email verification status');
    }
  }

  private async isSubsidiaryCompany(
    parentCompanyId: string,
    targetCompanyId: string,
  ): Promise<boolean> {
    try {
      const targetCompany = await this.companyRepository.findById({
        getValue: () => targetCompanyId,
      } as any);
      if (!targetCompany) {
        return false;
      }

      // Check if the target company's parent is the current user's company
      return targetCompany.isSubsidiaryOf({ getValue: () => parentCompanyId } as any);
    } catch (error) {
      this.logger.error('Error checking subsidiary relationship', {
        error: error.message,
        parentCompanyId,
        targetCompanyId,
      });

      return false;
    }
  }
}
