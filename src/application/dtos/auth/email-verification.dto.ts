import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, Length } from 'class-validator';

export class SendVerificationEmailDto {
  @ApiProperty({
    description: 'The email address to send verification code to',
    example: 'user@example.com',
  })
  @IsEmail()
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
  @Matches(/^\d+$/, { message: 'Phone number must contain only digits' })
  phoneNumber?: string;
}

export class VerifyEmailDto {
  @ApiProperty({
    description: 'The email address to verify',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: 'The verification code',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code!: string;
}
