import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RegisterDto } from '@application/dtos/auth/register.dto';
import { IUserBaseResponse } from '@application/dtos/responses/user.response';
import { Injectable } from '@nestjs/common';
import { UserService } from '@core/services/user.service';
import { UserMapper } from '@application/mappers/user.mapper';

export class RegisterUserCommand implements ICommand {
  constructor(public readonly registerDto: RegisterDto) {}
}

@Injectable()
@CommandHandler(RegisterUserCommand)
export class RegisterUserCommandHandler implements ICommandHandler<RegisterUserCommand> {
  constructor(private readonly userService: UserService) {}

  async execute(command: RegisterUserCommand): Promise<IUserBaseResponse> {
    const registerDto = command.registerDto;

    // Prepare options for extended user creation
    const options = {
      secondLastName: registerDto.secondLastName,
      isActive: registerDto.isActive,
      emailVerified: registerDto.emailVerified,
      bannedUntil: registerDto.bannedUntil ? new Date(registerDto.bannedUntil) : undefined,
      banReason: registerDto.banReason,
      agentPhone: registerDto.agentPhone,
      profile: registerDto.profile,
      address: registerDto.address,
      companyName: registerDto.company,
      roles: registerDto.roles,
    };

    const user = await this.userService.createUserWithExtendedData(
      registerDto.email,
      registerDto.password,
      registerDto.firstName,
      registerDto.lastName,
      options,
    );

    // Use the mapper to convert to response DTO
    return UserMapper.toBaseResponse(user);
  }
}
