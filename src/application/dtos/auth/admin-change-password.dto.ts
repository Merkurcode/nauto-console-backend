import { IsString, IsUUID, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  TrimString,
  TrimAndValidateLength,
} from '@shared/decorators/trim-and-validate-length.decorator';

export class AdminChangePasswordDto {
  @ApiProperty({
    description: 'ID of the user whose password will be changed',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4', { message: 'userId must be a valid UUID' })
  @TrimString()
  userId: string;

  @ApiProperty({
    description: 'New password for the user',
    example: 'NewSecureP@ssw0rd123',
    minLength: 8,
    maxLength: 100,
  })
  @IsString({ message: 'password must be a string' })
  @TrimAndValidateLength({ min: 8, max: 100 })
  @MinLength(8, { message: 'password must be at least 8 characters long' })
  @MaxLength(100, { message: 'password must not exceed 100 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]+$/, {
    message:
      'password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
  })
  password: string;
}
