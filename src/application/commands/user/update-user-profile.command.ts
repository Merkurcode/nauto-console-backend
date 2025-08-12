import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { UserService } from '@core/services/user.service';
import { IUserDetailResponse } from '@application/dtos/_responses/user/user.response';
import { UserMapper } from '@application/mappers/user.mapper';
import { UpdateUserProfileDto } from '@application/dtos/user/update-user-profile.dto';
import { IUpdateUserProfileServiceInput } from '@core/interfaces/user/update-user-profile-service-input.interface';

export class UpdateUserProfileCommand {
  constructor(
    public readonly targetUserId: string,
    public readonly currentUserId: string,
    public readonly updateData: UpdateUserProfileDto,
  ) {}
}

@Injectable()
@CommandHandler(UpdateUserProfileCommand)
export class UpdateUserProfileCommandHandler
  implements ICommandHandler<UpdateUserProfileCommand, IUserDetailResponse>
{
  constructor(private readonly userService: UserService) {}

  async execute(command: UpdateUserProfileCommand): Promise<IUserDetailResponse> {
    const { targetUserId, currentUserId, updateData } = command;

    // Use domain service to update user profile
    const updatedUser = await this.userService.updateUserProfile(
      targetUserId,
      currentUserId,
      updateData as IUpdateUserProfileServiceInput, // DTO to service type conversion
    );

    return UserMapper.toDetailResponse(updatedUser);
  }
}
