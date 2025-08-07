import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { LogoutScope } from '@shared/constants/enums';

export { LogoutScope };

export class LogoutDto {
  @ApiProperty({
    description: 'Logout scope - local (current session only) or global (all sessions)',
    enum: LogoutScope,
    default: LogoutScope.GLOBAL,
    required: false,
  })
  @IsOptional()
  @IsEnum(LogoutScope)
  scope?: LogoutScope = LogoutScope.GLOBAL;
}
