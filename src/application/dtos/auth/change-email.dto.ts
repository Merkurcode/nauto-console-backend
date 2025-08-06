import { IsString, IsEmail, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangeEmailDto {
  @ApiProperty({
    description: 'New email address',
    example: 'newemail@example.com',
  })
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  newEmail!: string;

  @ApiProperty({
    description: 'Current password of the target user for verification (always required)',
    example: 'CurrentPassword123!',
  })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({
    description: 'Target user ID (only for root/admin operations)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  targetUserId?: string;
}
