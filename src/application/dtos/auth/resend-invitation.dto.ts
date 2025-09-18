import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength, Matches } from 'class-validator';

export class ResendInvitationDto {
  @ApiPropertyOptional({
    description:
      'Optional new password for the user. If not provided, a secure password will be generated automatically',
    example: 'SecureP@ssw0rd123!',
    minLength: 8,
  })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^*()_+\-=\[\]{}|;:,.])[A-Za-z\d!@#$%^*()_+\-=\[\]{}|;:,.]{8,}$/,
    {
      message:
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    },
  )
  password?: string;
}
