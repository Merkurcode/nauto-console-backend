import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RegisterDto } from '@application/dtos/auth/register.dto';
import { IUserBaseResponse } from '@application/dtos/_responses/user/user.response';
import { Injectable } from '@nestjs/common';
import { UserService } from '@core/services/user.service';
import { UserMapper } from '@application/mappers/user.mapper';
import { PasswordGenerator } from '@shared/utils/password-generator';
import { UserStorageConfigService } from '@core/services/user-storage-config.service';
import { StorageTiersService } from '@core/services/storage-tiers.service';
import { ConfigService } from '@nestjs/config';

export class RegisterUserCommand implements ICommand {
  constructor(public readonly registerDto: RegisterDto) {}
}

@Injectable()
@CommandHandler(RegisterUserCommand)
export class RegisterUserCommandHandler implements ICommandHandler<RegisterUserCommand> {
  constructor(
    private readonly userService: UserService,
    private readonly userStorageConfigService: UserStorageConfigService,
    private readonly storageTiersService: StorageTiersService,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: RegisterUserCommand): Promise<IUserBaseResponse> {
    const registerDto = command.registerDto;

    // Generate random password if password is null, undefined, or empty
    let password = registerDto.password;
    if (!password || password.trim() === '') {
      password = PasswordGenerator.generateSecurePassword(12);
    }

    // Prepare options for extended user creation
    const options = {
      secondLastName: registerDto.secondLastName,
      isActive: registerDto.isActive,
      emailVerified: registerDto.emailVerified,
      bannedUntil: registerDto.bannedUntil ? new Date(registerDto.bannedUntil) : undefined,
      banReason: registerDto.banReason,
      agentPhone: registerDto.agentPhone,
      agentPhoneCountryCode: registerDto.agentPhoneCountryCode,
      profile: registerDto.profile,
      address: registerDto.address,
      companyName: registerDto.company,
      roles: registerDto.roles,
    };

    const user = await this.userService.createUserWithExtendedData(
      registerDto.email,
      password,
      registerDto.firstName,
      registerDto.lastName,
      options,
    );

    // Check if user creation was successful
    if (!user) {
      throw new Error('Failed to create user - user creation returned null');
    }

    // Create default UserStorageConfig with basic tier
    const defaultStorageTierLevel = this.configService.get<string>(
      'DEFAULT_STORAGE_TIER_LEVEL',
      '1',
    );
    const storageTier =
      await this.storageTiersService.getStorageTierByLevelOrThrow(defaultStorageTierLevel);

    await this.userStorageConfigService.createUserStorageConfig(user.id.getValue(), storageTier.id);

    // Use the mapper to convert to response DTO
    return UserMapper.toBaseResponse(user);
  }
}
