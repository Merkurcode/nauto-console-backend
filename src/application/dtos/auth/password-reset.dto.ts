import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';
import { NormalizeEmail } from '@shared/decorators/normalize-email.decorator';
import {
  TrimString,
  TrimAndValidateLength,
} from '@shared/decorators/trim-and-validate-length.decorator';

export class RequestPasswordResetDto {
  @ApiProperty({
    description: 'The email address of the account (case-insensitive, automatically trimmed)',
    example: 'user@example.com',
  })
  @NormalizeEmail()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: 'Captcha token for security validation',
    example: '03AGdBq26...',
  })
  @IsString()
  @IsNotEmpty()
  @TrimString()
  captchaToken!: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'The password reset token received via email',
    example: 'e12e3b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c',
  })
  @IsString()
  @IsNotEmpty()
  @TrimString()
  token!: string;

  @ApiProperty({
    description: 'The new password',
    example: 'StrongP@ssw0rd123',
  })
  @IsString()
  @TrimAndValidateLength({ min: 8 })
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number or special character',
  })
  newPassword!: string;
}
