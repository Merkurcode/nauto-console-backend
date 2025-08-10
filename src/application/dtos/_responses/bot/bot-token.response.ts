import { ApiProperty } from '@nestjs/swagger';

export class BotTokenResponse {
  @ApiProperty({
    description: 'Bot access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Token expiration time',
    example: 'never',
  })
  expiresIn: string;

  @ApiProperty({
    description: 'Unique token identifier',
    example: 'bot_1691424000_abc123def456',
  })
  tokenId: string;
}
