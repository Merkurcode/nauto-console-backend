import { ApiProperty } from '@nestjs/swagger';
import { ICompanyAIConfigResponse } from './company-ai-config.response.interface';

/**
 * Swagger DTO for Company AI Configuration responses
 * Following Clean Architecture: Application layer response DTOs for API documentation
 */
export class CompanyAIConfigResponseDto implements ICompanyAIConfigResponse {
  @ApiProperty({
    description: 'Company ID that owns this AI configuration',
    example: 'uuid-company-id',
  })
  companyId: string;

  @ApiProperty({
    description: 'Indicates if the company has any AI configuration set',
    example: true,
  })
  hasConfiguration: boolean;

  @ApiProperty({
    description: 'Timestamp when configuration was last updated',
    example: '2024-03-15T10:30:00.000Z',
  })
  lastUpdated: string;

  @ApiProperty({
    description: 'Welcome message displayed to users',
    required: false,
    example: 'Welcome! How can I assist you today?',
  })
  welcomeMessage?: string;

  @ApiProperty({
    description: 'AI model temperature setting (0.0 to 1.0) - Controls randomness/creativity',
    required: false,
    example: 0.7,
  })
  temperature?: number;

  @ApiProperty({
    description: 'Instructions for AI response behavior',
    required: false,
    example: 'Respond in a professional and helpful manner. Always ask clarifying questions.',
  })
  responseInstructions?: string;

  @ApiProperty({
    description: 'Instructions for discovering client needs',
    required: false,
    example:
      'Ask targeted questions to understand the client specific requirements and pain points.',
  })
  clientDiscoveryInstructions?: string;
}
