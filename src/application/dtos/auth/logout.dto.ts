import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum LogoutScope {
  LOCAL = 'local',
  GLOBAL = 'global',
}

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