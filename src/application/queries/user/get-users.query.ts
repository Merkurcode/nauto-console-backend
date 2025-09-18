import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { UserService } from '@core/services/user.service';
import { IUserDetailResponse } from '@application/dtos/_responses/user/user.response';
import { UserMapper } from '@application/mappers/user.mapper';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';
import { IOtpRepository } from '@core/repositories/otp.repository.interface';
import { OTP_REPOSITORY } from '@shared/constants/tokens';

export class GetUsersQuery implements IQuery {
  constructor(
    public readonly companyId: string,
    public readonly currentUserId: string,
  ) {}
}

@Injectable()
@QueryHandler(GetUsersQuery)
export class GetUsersQueryHandler implements IQueryHandler<GetUsersQuery> {
  constructor(
    private readonly userService: UserService,
    private readonly userAuthorizationService: UserAuthorizationService,
    @Inject(OTP_REPOSITORY)
    private readonly otpRepository: IOtpRepository,
  ) {}

  async execute(query: GetUsersQuery): Promise<IUserDetailResponse[]> {
    const { companyId, currentUserId } = query;

    // Get current user
    const currentUser = await this.userService.getUserById(currentUserId);
    if (!currentUser) {
      throw new EntityNotFoundException('User', currentUserId);
    }

    // Delegate authorization check to domain service
    // This will throw appropriate domain exceptions if not authorized
    this.userAuthorizationService.validateCanQueryCompanyUsers(currentUser, companyId);

    // Get users from service
    const users = await this.userService.getAllUsers(companyId);

    // Use the mapper to convert each user to response DTO with OTP information
    const userResponses = await Promise.all(
      users.map(async user => {
        // Get current OTP for user if they haven't verified email yet
        const otp = !user.emailVerified
          ? await this.otpRepository.findByUserId(user.id.getValue())
          : null;

        return UserMapper.toDetailResponse(user, otp);
      }),
    );

    return userResponses;
  }
}
