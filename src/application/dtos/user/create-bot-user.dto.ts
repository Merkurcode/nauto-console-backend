import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBotUserDto {
  @ApiProperty({
    description: 'Bot alias (unique identifier for the bot user)',
    example: 'chatbot-external-001',
    minLength: 3,
    maxLength: 50,
  })
  @IsString()
  alias: string;

  @ApiProperty({
    description: 'Company ID where the bot will be assigned',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  companyId: string;

  @ApiProperty({
    description: 'Bot password for authentication',
    example: 'SecureP@ssw0rd123!',
    minLength: 8,
  })
  @IsString()
  password: string;
}
