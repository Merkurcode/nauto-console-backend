import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { TrimString } from '@shared/decorators/trim-and-validate-length.decorator';

export class Setup2FADto {
  @ApiProperty({
    description: 'The user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  @TrimString()
  userId!: string;
}

export class Verify2FADto {
  @ApiProperty({
    description: 'The user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  @TrimString()
  userId!: string;

  @ApiProperty({
    description: 'The 2FA verification token',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @TrimString()
  token!: string;
}

export class Disable2FADto {
  @ApiProperty({
    description: 'The user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  @TrimString()
  userId!: string;
}

export class Generate2FADto {
  @ApiProperty({
    description: 'The user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  @TrimString()
  userId!: string;
}
