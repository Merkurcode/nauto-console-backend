import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class RequestPasswordResetDto {
  @ApiProperty({
    description: 'The email address of the account',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: 'Captcha token for security validation',
    example: '03AGdBq26...',
  })
  @IsString()
  @IsNotEmpty()
  captchaToken!: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'The password reset token received via email',
    example: 'e12e3b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({
    description: 'The new password',
    example: 'StrongP@ssw0rd123',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number or special character',
  })
  newPassword!: string;
}
