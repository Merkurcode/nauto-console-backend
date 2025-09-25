import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrimAndValidateLength } from '@shared/decorators/trim-and-validate-length.decorator';
import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, MinLength, IsDate } from 'class-validator';

export class BanUserDto {
  @ApiProperty({
    description: 'Reason for banning the user',
    example: 'Violation of terms of service - repeated spam behavior',
    minLength: 5,
  })
  @IsString()
  @IsNotEmpty()
  @TrimAndValidateLength({ min: 5 })
  @MinLength(5)
  banReason: string;

  @ApiPropertyOptional({
    description: 'Date until which the user is banned. If not provided, the ban is permanent',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  bannedUntil?: Date;
}
