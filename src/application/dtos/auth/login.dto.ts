import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NormalizeEmail } from '@shared/decorators/normalize-email.decorator';
import { TrimAndValidateLength } from '@shared/decorators/trim-and-validate-length.decorator';

export class LoginDto {
  @ApiProperty({
    description: 'User email address (case-insensitive, automatically trimmed)',
    example: 'user@example.com',
  })
  @NormalizeEmail()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: 'User password',
    example: 'Password123!',
    minLength: 8,
  })
  @IsString()
  @TrimAndValidateLength({ min: 8 })
  @IsNotEmpty()
  @MinLength(8)
  password!: string;
}
