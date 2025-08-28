import { IsNotEmpty, IsString, Length, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  TrimString,
  TrimAndValidateLength,
} from '@shared/decorators/trim-and-validate-length.decorator';

export class VerifyOtpDto {
  @ApiProperty({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  @TrimString()
  userId!: string;

  @ApiProperty({
    description: 'One-time password (6 digits)',
    example: '123456',
  })
  @IsString()
  @TrimAndValidateLength({ min: 6, max: 6 })
  @IsNotEmpty()
  @Length(6, 6)
  otp!: string;
}
