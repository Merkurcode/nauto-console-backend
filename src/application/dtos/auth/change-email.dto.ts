import { IsString, IsEmail, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NormalizeEmail } from '@shared/decorators/normalize-email.decorator';
import { TrimString } from '@shared/decorators/trim-and-validate-length.decorator';

export class ChangeEmailDto {
  @ApiProperty({
    description: 'New email address (case-insensitive, automatically trimmed)',
    example: 'newemail@example.com',
  })
  @NormalizeEmail()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  newEmail!: string;

  @ApiProperty({
    description: 'Current password of the target user for verification (always required)',
    example: 'CurrentPassword123!',
  })
  @IsString()
  @IsNotEmpty()
  @TrimString()
  currentPassword!: string;

  @ApiProperty({
    description: 'Target user ID (only for root/admin operations)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  @TrimString()
  targetUserId?: string;
}
