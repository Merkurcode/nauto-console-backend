import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, Length } from 'class-validator';
import { NormalizeEmail } from '@shared/decorators/normalize-email.decorator';
import {
  TrimString,
  TrimAndValidateLength,
} from '@shared/decorators/trim-and-validate-length.decorator';

export class SendVerificationEmailDto {
  @ApiProperty({
    description:
      'The email address to send verification code to (case-insensitive, automatically trimmed)',
    example: 'user@example.com',
  })
  @NormalizeEmail()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description:
      'Optional phone number to also send SMS verification (digits only, no country code)',
    example: '5512345678',
    required: false,
  })
  @IsOptional()
  @IsString()
  @TrimString()
  @Matches(/^\d+$/, { message: 'Phone number must contain only digits' })
  phoneNumber?: string;
}

export class VerifyEmailDto {
  @ApiProperty({
    description: 'The email address to verify (case-insensitive, automatically trimmed)',
    example: 'user@example.com',
  })
  @NormalizeEmail()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: 'The verification code',
    example: '123456',
  })
  @IsString()
  @TrimAndValidateLength({ min: 6, max: 6 })
  @IsNotEmpty()
  @Length(6, 6)
  code!: string;
}
