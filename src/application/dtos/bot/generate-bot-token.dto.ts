import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TrimString } from '@shared/decorators/trim-and-validate-length.decorator';

export class GenerateBotTokenDto {
  @ApiProperty({
    description: 'Bot user alias for authentication',
    example: 'chatbot-external-001',
  })
  @IsString()
  @TrimString()
  botAlias: string;

  @ApiProperty({
    description: 'Bot password for authentication',
    example: 'SecureP@ssw0rd123!',
  })
  @IsString()
  @TrimString()
  password: string;
}
